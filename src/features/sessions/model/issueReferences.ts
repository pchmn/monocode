import type { GithubWorkItem } from "../../inbox/model/githubTasks";
import { normalizeProjectPath } from "../../projects/model/recents";
import {
  loadIssueMentionItems,
  searchIssueMentionItems,
} from "./issueMentions";

type MarkdownNode = {
  type: string;
  value?: string;
  url?: string;
  children?: MarkdownNode[];
};

// A fragment href survives sanitizing and hardening, unlike a custom scheme.
const HREF_PREFIX = "#monocode-issue-";
const REFERENCE = /(?<![\w#&/.-])#(\d{1,7})(?![\w-])/g;
const SKIPPED = new Set([
  "link",
  "linkReference",
  "inlineCode",
  "code",
  "html",
]);
const MISS_TTL_MS = 60_000;

export function issueReferenceNumber(href: string | undefined): number | null {
  if (!href?.startsWith(HREF_PREFIX)) return null;
  const number = Number(href.slice(HREF_PREFIX.length));
  return Number.isInteger(number) && number > 0 ? number : null;
}

function splitText(value: string): MarkdownNode[] | null {
  const parts: MarkdownNode[] = [];
  let last = 0;
  for (const match of value.matchAll(REFERENCE)) {
    const at = match.index;
    if (at > last) parts.push({ type: "text", value: value.slice(last, at) });
    parts.push({
      type: "link",
      url: `${HREF_PREFIX}${match[1]}`,
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

async function lookup(cwd: string, number: number) {
  // Fails fast outside a GitHub repo, before any per-number lookup.
  const recent = await loadIssueMentionItems(cwd, "all");
  const hit = recent.find((item) => item.number === number);
  if (hit) return hit;
  const [found] = await searchIssueMentionItems(cwd, "all", String(number));
  return found ?? null;
}

/** The issue or PR `#number` names in the project's GitHub repo, or null. */
export function resolveIssueReference(
  cwd: string,
  number: number,
): Promise<GithubWorkItem | null> {
  const key = `${normalizeProjectPath(cwd)}|${number}`;
  const hit = references.get(key);
  if (hit) return hit;
  const promise = lookup(cwd, number).catch(() => null);
  references.set(key, promise);
  // A miss may be an issue opened since: allow a retry later.
  void promise.then((item) => {
    if (!item) setTimeout(() => references.delete(key), MISS_TTL_MS);
  });
  return promise;
}
