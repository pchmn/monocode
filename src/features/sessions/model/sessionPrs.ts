import type { Block, LinkedWorkItem } from "./session";

type Store = Record<string, LinkedWorkItem[]>;

const STORAGE_KEY = "monocode.sessionPrs";
const MAX_SESSIONS = 300;
const EMPTY: LinkedWorkItem[] = [];
const listeners = new Set<() => void>();
let cache: Store | null = null;

const CREATE_PR = /\bgh\s+pr\s+create\b|create_pull_request/i;
const PR_URL = /https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)/g;

type ToolBlock = Block & { tool: NonNullable<Block["tool"]> };

function printedPr(block: Block): LinkedWorkItem | undefined {
  const tool = block.tool;
  if (!tool?.detail || tool.status === "failed") return undefined;
  // A failed create can still print an existing PR's URL ("already exists"): take the last one only.
  const matches = [...tool.detail.matchAll(PR_URL)];
  const match = matches[matches.length - 1];
  if (!match) return undefined;
  return {
    kind: "pr",
    repo: match[1]!,
    number: Number(match[2]),
    url: `https://github.com/${match[1]}/pull/${match[2]}`,
  };
}

// A shell row's title keeps only the command's first line; Codex keeps it whole in the preview title.
function createsPr({ tool }: ToolBlock, commands: Readonly<Record<string, string>>) {
  const command = tool.callId ? commands[tool.callId] : undefined;
  return [tool.title, tool.preview?.title, command].some((text) => text && CREATE_PR.test(text));
}

/**
 * PRs the agent opened: a `gh pr create` (or GitHub MCP) call whose output holds the new PR's URL.
 * `commands` holds full shell commands by tool call id.
 */
export function createdPrsFromBlocks(
  blocks: readonly Block[],
  commands: Readonly<Record<string, string>> = {},
): LinkedWorkItem[] {
  return blocks.flatMap((block) => {
    const pr = printedPr(block);
    return pr && createsPr(block as ToolBlock, commands) ? [pr] : [];
  });
}

/** Shell calls that printed a PR URL but whose full command is still unknown. */
export function prCallsMissingCommand(
  blocks: readonly Block[],
  commands: Readonly<Record<string, string>>,
): string[] {
  return blocks.flatMap((block) => {
    const callId = block.tool?.callId;
    if (!callId || callId in commands || block.tool?.kind !== "execute") return [];
    return printedPr(block) && !createsPr(block as ToolBlock, commands) ? [callId] : [];
  });
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
