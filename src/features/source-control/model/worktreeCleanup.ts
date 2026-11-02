import { invoke } from "@tauri-apps/api/core";
import { isEqualOrInside, joinPath } from "../../../shared/lib/paths";
import type { Session } from "../../sessions/model/session";
import type { Worktree } from "./worktrees";

export type WorktreeCleanupStatus = {
  path: string;
  clean: boolean;
  integrated: boolean;
  hasCommits: boolean;
};

export type CleanupCandidate = {
  cwd: string;
  path: string;
  /** "session": the closed session's own worktree; "agent": one an agent created under `.worktrees/`. */
  origin: "session" | "agent";
};

export const AGENT_WORKTREES_DIR = ".worktrees";

type SessionRef = Pick<Session, "id" | "cwd" | "worktreeCwd" | "worktreeRemoved" | "busy">;

/** Used by an open tab, or by a session still running outside one. */
function inUse(
  path: string,
  sessions: readonly SessionRef[],
  openIds: ReadonlySet<string>,
  closedIds: ReadonlySet<string>,
) {
  return sessions.some(
    (session) =>
      (openIds.has(session.id) || (session.busy && !closedIds.has(session.id))) &&
      !!session.worktreeCwd &&
      isEqualOrInside(session.worktreeCwd, path),
  );
}

/** Worktrees of the closed sessions that no open session still uses. */
export function closedSessionWorktrees(
  closedIds: ReadonlySet<string>,
  openIds: ReadonlySet<string>,
  sessions: readonly SessionRef[],
): CleanupCandidate[] {
  const candidates = new Map<string, CleanupCandidate>();
  for (const session of sessions) {
    const path = session.worktreeCwd;
    if (!closedIds.has(session.id) || !path || session.worktreeRemoved) continue;
    if (inUse(path, sessions, openIds, closedIds)) continue;
    candidates.set(path, { cwd: session.cwd, path, origin: "session" });
  }
  return [...candidates.values()];
}

/** Agent-made worktrees of a project, skipped while any other session of it runs: its agent may be inside one. */
export function agentWorktrees(
  cwd: string,
  trees: readonly Worktree[],
  openIds: ReadonlySet<string>,
  closedIds: ReadonlySet<string>,
  sessions: readonly SessionRef[],
): CleanupCandidate[] {
  const main = trees.find((tree) => tree.isMain);
  if (!main) return [];
  const busy = sessions.some(
    (session) =>
      session.busy && !closedIds.has(session.id) && isEqualOrInside(session.cwd, main.path),
  );
  if (busy) return [];
  const root = joinPath(main.path, AGENT_WORKTREES_DIR);
  return trees
    .filter(
      (tree) =>
        !tree.isMain &&
        !tree.locked &&
        !tree.missing &&
        !!tree.branch &&
        isEqualOrInside(tree.path, root) &&
        !inUse(tree.path, sessions, openIds, closedIds),
    )
    .map((tree) => ({ cwd, path: tree.path, origin: "agent" }));
}

/** Nothing is lost by removing it. An agent's worktree with no commit yet may be work about to start. */
export function isRemovable(candidate: CleanupCandidate, status: WorktreeCleanupStatus) {
  return (
    status.clean &&
    status.integrated &&
    (candidate.origin === "session" || status.hasCommits)
  );
}

export function worktreeCleanupStatus(cwd: string, paths: string[]) {
  return invoke<WorktreeCleanupStatus[]>("worktree_cleanup_status", { cwd, paths });
}
