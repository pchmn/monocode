import type { Block, LinkedWorkItem } from "./session";

type Store = Record<string, LinkedWorkItem[]>;

const STORAGE_KEY = "monocode.sessionPrs";
const MAX_SESSIONS = 300;
const EMPTY: LinkedWorkItem[] = [];
const listeners = new Set<() => void>();
let cache: Store | null = null;

const CREATE_PR_TITLE = /\bgh\s+pr\s+create\b|create_pull_request/i;
const PR_URL = /https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)/g;

/** PRs the agent opened: a `gh pr create` (or GitHub MCP) call whose output holds the new PR's URL. */
export function createdPrsFromBlocks(blocks: readonly Block[]): LinkedWorkItem[] {
  const found: LinkedWorkItem[] = [];
  for (const block of blocks) {
    const tool = block.tool;
    if (!tool?.detail || tool.status === "failed") continue;
    if (!CREATE_PR_TITLE.test(tool.title ?? "")) continue;
    // A failed create can still print an existing PR's URL ("already exists"): take the last one only.
    const matches = [...tool.detail.matchAll(PR_URL)];
    const match = matches[matches.length - 1];
    if (!match) continue;
    found.push({
      kind: "pr",
      repo: match[1]!,
      number: Number(match[2]),
      url: `https://github.com/${match[1]}/pull/${match[2]}`,
    });
  }
  return found;
}

function sameItem(a: LinkedWorkItem, b: LinkedWorkItem) {
  return a.kind === b.kind && a.number === b.number && a.repo.toLowerCase() === b.repo.toLowerCase();
}

function load(): Store {
  if (cache) return cache;
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    cache = value && typeof value === "object" ? (value as Store) : {};
  } catch {
    cache = {};
  }
  return cache;
}

export function peekSessionPrs(sessionId: string): LinkedWorkItem[] {
  return load()[sessionId] ?? EMPTY;
}

export function subscribeSessionPrs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function addSessionPrs(sessionId: string, items: readonly LinkedWorkItem[]) {
  const current = peekSessionPrs(sessionId);
  const added = items.filter(
    (item, i) =>
      !current.some((known) => sameItem(known, item)) &&
      items.findIndex((other) => sameItem(other, item)) === i,
  );
  if (!added.length) return;
  const { [sessionId]: _, ...rest } = load();
  const kept = Object.entries(rest).slice(-(MAX_SESSIONS - 1));
  cache = { ...Object.fromEntries(kept), [sessionId]: [...current, ...added] };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Storage unavailable: the PRs stay listed until the app quits.
  }
  for (const listener of listeners) listener();
}

/** The linked item first, then every other PR the session met, without duplicates. */
export function sessionWorkItems(
  linked: LinkedWorkItem | undefined,
  prs: readonly LinkedWorkItem[],
): LinkedWorkItem[] {
  const items = linked ? [linked] : [];
  for (const pr of prs) {
    if (!items.some((item) => sameItem(item, pr))) items.push(pr);
  }
  return items;
}

export function resetSessionPrsForTest() {
  cache = null;
  listeners.clear();
}
