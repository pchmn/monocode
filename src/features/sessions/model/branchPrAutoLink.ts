import { hasOwnWorktree } from "../../projects/model/workspaceFolderWorktrees";
import type { LinkedWorkItem, Session } from "./session";

export type BranchPr = { number: number; url: string };

type Listener = (sessionId: string, pr: BranchPr) => void;

const STORAGE_KEY = "monocode.branchPrAutoLinked";
const MAX_REMEMBERED = 500;
const listeners = new Set<Listener>();

export function reportBranchPr(sessionId: string, pr: BranchPr) {
  for (const listener of listeners) listener(sessionId, pr);
}

/**
 * The session id once its checkout is final: a draft still sits on the project's
 * default folder, whose branch PR is not the session's.
 */
export function branchPrSessionId(
  session: Pick<
    Session,
    "id" | "blocks" | "cwd" | "worktreeCwd" | "workspaceMode"
  >,
): string | undefined {
  const sent = session.blocks.some(
    (block) => block.role === "user" && !block.draft,
  );
  const worktreePending =
    session.workspaceMode === "worktree" && !hasOwnWorktree(session);
  return sent && !worktreePending ? session.id : undefined;
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
