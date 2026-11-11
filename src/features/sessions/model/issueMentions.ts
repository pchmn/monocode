import { invoke } from "../../projects/model/workspaceInvoke";
import {
  githubRepo,
  type GithubTaskKind,
  type GithubWorkItem,
} from "../../inbox/model/githubTasks";
import { normalizeProjectPath } from "../../projects/model/recents";
import { isMarkdownBlockquotePosition } from "./quoteDraft";

export type IssueMentionToken = {
  start: number;
  end: number;
  query: string;
};

export type RankedIssue = GithubWorkItem & { positions: number[] };

export type IssueScope = "open" | "all";

const SCOPE_KEY = "monocode.issueMentions.scope";

const MAX_QUERY = 80;
const MAX_RESULTS = 30;
const FETCH_LIMIT = 100;
const CACHE_TTL_MS = 60_000;

/** `#query` token around `cursor`, if the user is typing an issue/PR reference. */
export function issueTokenAt(
  text: string,
  cursor: number,
): IssueMentionToken | null {
  const i = Math.max(0, Math.min(cursor, text.length));
  let start = i;
  while (start > 0 && !/\s/.test(text[start - 1]!)) start -= 1;
  if (text[start] !== "#") return null;
  if (isMarkdownBlockquotePosition(text, start)) return null;

  let end = start + 1;
  while (end < text.length && !/\s/.test(text[end]!)) end += 1;

  const query = text.slice(start + 1, i);
  // `##`, `#a#b`: Markdown headings or plain hashes, not a reference.
  if (query.includes("#") || query.length > MAX_QUERY) return null;
  return { start, end, query };
}

export function replaceIssueToken(
  text: string,
  token: IssueMentionToken,
  number: number,
): { text: string; cursor: number } {
  const label = `#${number}`;
  const rest = text.slice(token.end);
  const spacer = rest.startsWith(" ") ? "" : " ";
  return {
    text: text.slice(0, token.start) + label + spacer + rest,
    cursor: token.start + label.length + 1,
  };
}

export function loadIssueScope(): IssueScope {
  try {
    return localStorage.getItem(SCOPE_KEY) === "all" ? "all" : "open";
  } catch {
    return "open";
  }
}

export function saveIssueScope(scope: IssueScope) {
  try {
    localStorage.setItem(SCOPE_KEY, scope);
  } catch {
    // Storage unavailable: the choice lasts for this session only.
  }
}

const itemKey = (item: GithubWorkItem) => `${item.kind}:${item.number}`;

/**
 * Number prefix first, then title matches, then `remote` hits GitHub matched
 * on fields we cannot see locally; most recently updated wins ties.
 */
export function rankIssues(
  items: GithubWorkItem[],
  query: string,
  remote: GithubWorkItem[] = [],
): RankedIssue[] {
  const q = query.trim().toLowerCase();
  const seen = new Set(items.map(itemKey));
  const remoteOnly = new Set<GithubWorkItem>(
    remote.filter((item) => !seen.has(itemKey(item))),
  );
  const byRecent = [...items, ...remoteOnly].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  if (!q) {
    return byRecent
      .slice(0, MAX_RESULTS)
      .map((item) => ({ ...item, positions: [] }));
  }
  const numberHits: RankedIssue[] = [];
  const titleHits: RankedIssue[] = [];
  const otherHits: RankedIssue[] = [];
  for (const item of byRecent) {
    if (String(item.number).startsWith(q)) {
      numberHits.push({ ...item, positions: [] });
      continue;
    }
    const at = item.title.toLowerCase().indexOf(q);
    if (at !== -1) {
      titleHits.push({
        ...item,
        positions: Array.from({ length: q.length }, (_, k) => at + k),
      });
    } else if (remoteOnly.has(item)) {
      otherHits.push({ ...item, positions: [] });
    }
  }
  numberHits.sort((a, b) => a.number - b.number);
  return [...numberHits, ...titleHits, ...otherHits].slice(0, MAX_RESULTS);
}

const cache = new Map<
  string,
  { at: number; promise: Promise<GithubWorkItem[]> }
>();

function cached(
  key: string,
  load: () => Promise<GithubWorkItem[]>,
): Promise<GithubWorkItem[]> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.promise;
  const promise = load();
  cache.set(key, { at: Date.now(), promise });
  promise.catch(() => cache.delete(key));
  return promise;
}

function listKind(
  cwd: string,
  repo: string,
  kind: GithubTaskKind,
  scope: IssueScope,
  search: string,
) {
  return invoke<GithubWorkItem[]>("git_github_work_items", {
    cwd,
    repo,
    kind,
    assignedToMe: false,
    state: scope,
    search,
    limit: search ? MAX_RESULTS : FETCH_LIMIT,
  });
}

async function listBoth(cwd: string, scope: IssueScope, search: string) {
  const repo = await githubRepo(cwd);
  const [issues, prs] = await Promise.all([
    listKind(cwd, repo, "issue", scope, search),
    listKind(cwd, repo, "pr", scope, search),
  ]);
  return [...issues, ...prs];
}

/** Most recently updated issues and PRs of the project's GitHub repo. */
export function loadIssueMentionItems(
  cwd: string,
  scope: IssueScope,
): Promise<GithubWorkItem[]> {
  return cached(`${normalizeProjectPath(cwd)}|${scope}`, () =>
    listBoth(cwd, scope, ""),
  );
}

/** GitHub-side search, for items beyond the recent list; a number is looked up directly. */
export function searchIssueMentionItems(
  cwd: string,
  scope: IssueScope,
  query: string,
): Promise<GithubWorkItem[]> {
  const q = query.trim();
  const key = `${normalizeProjectPath(cwd)}|${scope}|${q.toLowerCase()}`;
  if (/^\d+$/.test(q)) {
    return cached(key, () => lookupNumber(cwd, scope, Number(q)));
  }
  return cached(key, () => listBoth(cwd, scope, q));
}

async function lookupNumber(cwd: string, scope: IssueScope, number: number) {
  const repo = await githubRepo(cwd);
  // `gh issue view` also resolves PR numbers, so prefer the PR answer.
  const [pr, issue] = await Promise.allSettled(
    (["pr", "issue"] as const).map((kind) =>
      invoke<GithubWorkItem>("git_github_work_item", { cwd, repo, kind, number }),
    ),
  );
  const hit =
    pr.status === "fulfilled"
      ? pr.value
      : issue.status === "fulfilled"
        ? issue.value
        : null;
  if (!hit || (scope === "open" && hit.state !== "open")) return [];
  return [hit];
}
