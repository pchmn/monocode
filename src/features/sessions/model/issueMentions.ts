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

/** Number prefix first, then title matches; most recently updated wins ties. */
export function rankIssues(items: GithubWorkItem[], query: string): RankedIssue[] {
  const q = query.trim().toLowerCase();
  const byRecent = [...items].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  if (!q) {
    return byRecent
      .slice(0, MAX_RESULTS)
      .map((item) => ({ ...item, positions: [] }));
  }
  const numberHits: RankedIssue[] = [];
  const titleHits: RankedIssue[] = [];
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
    }
  }
  numberHits.sort((a, b) => a.number - b.number);
  return [...numberHits, ...titleHits].slice(0, MAX_RESULTS);
}

const cache = new Map<
  string,
  { at: number; promise: Promise<GithubWorkItem[]> }
>();

function listKind(cwd: string, repo: string, kind: GithubTaskKind) {
  return invoke<GithubWorkItem[]>("git_github_work_items", {
    cwd,
    repo,
    kind,
    assignedToMe: false,
    state: "open",
    search: "",
    limit: FETCH_LIMIT,
  });
}

/** Open issues and PRs of the project's GitHub repo, cached for a minute. */
export function loadIssueMentionItems(cwd: string): Promise<GithubWorkItem[]> {
  const key = normalizeProjectPath(cwd);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.promise;
  const promise = githubRepo(cwd).then(async (repo) => {
    const [issues, prs] = await Promise.all([
      listKind(cwd, repo, "issue"),
      listKind(cwd, repo, "pr"),
    ]);
    return [...issues, ...prs];
  });
  cache.set(key, { at: Date.now(), promise });
  promise.catch(() => cache.delete(key));
  return promise;
}
