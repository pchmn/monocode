import type { LinkedWorkItem } from "./session";

export type BranchPr = { number: number; url: string };

type Listener = (sessionId: string, pr: BranchPr) => void;

const STORAGE_KEY = "monocode.branchPrAutoLinked";
const MAX_REMEMBERED = 500;
const listeners = new Set<Listener>();

export function reportBranchPr(sessionId: string, pr: BranchPr) {
  for (const listener of listeners) listener(sessionId, pr);
}

export function onBranchPr(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function linkedWorkItemFromPrUrl(pr: BranchPr): LinkedWorkItem | null {
  const match = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/\d+/.exec(
    pr.url,
  );
  return match
    ? { kind: "pr", repo: match[1]!, number: pr.number, url: pr.url }
    : null;
}

function remembered(): string[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]",
    );
    return Array.isArray(value)
      ? value.filter((v) => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

/** True the first time a session meets this PR, so a manual relink afterwards sticks. */
export function claimAutoLink(sessionId: string, prNumber: number): boolean {
  const key = `${sessionId}:${prNumber}`;
  const keys = remembered();
  if (keys.includes(key)) return false;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([...keys, key].slice(-MAX_REMEMBERED)),
    );
  } catch {
    // Storage unavailable: the link may be applied again next launch.
  }
  return true;
}
