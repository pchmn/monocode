import type { GithubWorkItem } from "../../inbox/model/githubTasks";
import { normalizeProjectPath } from "../../projects/model/recents";
import type { UserLink, UserMessageLink } from "./linkPreview";
import { githubRepo } from "../../inbox/model/githubTasks";
import {
  loadIssueMentionItems,
  lookupWorkItem,
  searchIssueMentionItems,
} from "./issueMentions";
import { workspaceSiblingRepos } from "./workspaceSiblingRepos";

type MarkdownNode = {
  type: string;
  value?: string;
  url?: string;
  children?: MarkdownNode[];
};

// A fragment href survives sanitizing and hardening, unlike a custom scheme.
const HREF_PREFIX = "#monocode-issue-";
// `#12`, or `repo#12` / `owner/repo#12` for another GitHub repo.
const REFERENCE =
  /(?<![\w#&/.-])(?<!\[Image )((?:[\w.-]+\/)?[\w.-]+)?#(\d{1,7})(?![\w-])/g;
const SKIPPED = new Set([
  "link",
  "linkReference",
  "inlineCode",
  "code",
  "html",
]);
const MISS_TTL_MS = 60_000;

/** `repo` as written in the text (`name` or `owner/name`), null for the project's repo. */
export type IssueTarget = { number: number; repo: string | null };

export function issueReferenceTarget(
  href: string | undefined,
): IssueTarget | null {
  if (!href?.startsWith(HREF_PREFIX)) return null;
  const [digits, repo] = href.slice(HREF_PREFIX.length).split("@", 2);
  const number = Number(digits);
  if (!Number.isInteger(number) || number <= 0) return null;
  return { number, repo: repo || null };
}

export type IssueReference = { number: number; index: number; length: number };

export function findIssueReferences(text: string): IssueReference[] {
  return [...text.matchAll(REFERENCE)]
    .filter((match) => !match[1])
    .map((match) => ({
      number: Number(match[2]),
      index: match.index,
      length: match[0].length,
    }));
}

export type UserMessageLinks = UserMessageLink & {
  /** Chips inside `afterText`, with offsets relative to it. */
  afterLinks: { link: UserLink; index: number; length: number }[];
};

/** The first URL or resolved `#123` as the main chip, later resolved references as extra chips. */
export function userMessageLinks(
  text: string,
  urlLink: UserMessageLink | null,
  references: readonly IssueReference[],
  resolved: ReadonlyMap<number, UserLink>,
): UserMessageLinks | null {
  let main = urlLink;
  if (!main) {
    const first = references.find((ref) => resolved.has(ref.number));
    if (!first) return null;
    main = {
      link: resolved.get(first.number)!,
      beforeText: text.slice(0, first.index),
      afterText: text.slice(first.index + first.length),
    };
  }
  const offset = text.length - main.afterText.length;
  const afterLinks = references.flatMap((ref) => {
    const link = resolved.get(ref.number);
    return link && ref.index >= offset
      ? [{ link, index: ref.index - offset, length: ref.length }]
      : [];
  });
  return { ...main, afterLinks };
}

function splitText(value: string): MarkdownNode[] | null {
  const parts: MarkdownNode[] = [];
  let last = 0;
  for (const match of value.matchAll(REFERENCE)) {
    const at = match.index;
    if (at > last) parts.push({ type: "text", value: value.slice(last, at) });
    parts.push({
      type: "link",
      url: `${HREF_PREFIX}${match[2]}${match[1] ? `@${match[1]}` : ""}`,
      children: [{ type: "text", value: match[0] }],
    });
    last = at + match[0].length;
  }
  if (parts.length === 0) return null;
  if (last < value.length)
    parts.push({ type: "text", value: value.slice(last) });
  return parts;
}

/** Turn `#123` in prose into links that `IssueReferenceLink` resolves. */
export function remarkIssueReferences() {
  function visit(node: MarkdownNode) {
    if (SKIPPED.has(node.type) || !node.children) return;
    node.children = node.children.flatMap((child) => {
      if (child.type === "text" && child.value) {
        return splitText(child.value) ?? [child];
      }
      visit(child);
      return [child];
    });
  }
  return visit;
}

const references = new Map<string, Promise<GithubWorkItem | null>>();

async function lookupInProject(cwd: string, number: number) {
  // Fails fast outside a GitHub repo, before any per-number lookup.
  const recent = await loadIssueMentionItems(cwd, "all");
  const hit = recent.find((item) => item.number === number);
  if (hit) return hit;
  const [found] = await searchIssueMentionItems(cwd, "all", String(number));
  return found ?? null;
}

/** `name` as the workspace repo of that name, else as a repo of the project's owner. */
async function qualifyRepo(cwd: string, name: string, siblings: string[]) {
  const current = await githubRepo(cwd).catch(() => null);
  const known = [current, ...siblings].find(
    (repo) => repo?.split("/")[1]?.toLowerCase() === name.toLowerCase(),
  );
  if (known) return known;
  if (!current) throw new Error("No GitHub owner to qualify the repo with");
  return `${current.split("/")[0]}/${name}`;
}

async function lookup(cwd: string, number: number, repo: string | null) {
  if (repo?.includes("/")) return lookupWorkItem(cwd, repo, number);
  const siblings = await workspaceSiblingRepos(cwd);
  if (repo) {
    return lookupWorkItem(cwd, await qualifyRepo(cwd, repo, siblings), number);
  }
  const own = await lookupInProject(cwd, number).catch(() => null);
  if (own) return own;
  // A bare number the project lacks may name an item of another workspace repo.
  const hits = await Promise.all(
    siblings.map((other) => lookupWorkItem(cwd, other, number)),
  );
  return hits.find(Boolean) ?? null;
}

/** The issue or PR `#number` names in `repo`, by default the project's GitHub repo, or null. */
export function resolveIssueReference(
  cwd: string,
  number: number,
  repo: string | null = null,
): Promise<GithubWorkItem | null> {
  const key = `${normalizeProjectPath(cwd)}|${repo ?? ""}|${number}`;
  const hit = references.get(key);
  if (hit) return hit;
  const promise = lookup(cwd, number, repo).catch(() => null);
  references.set(key, promise);
  // A miss may be an issue opened since: allow a retry later.
  void promise.then((item) => {
    if (!item) setTimeout(() => references.delete(key), MISS_TTL_MS);
  });
  return promise;
}
