import { useEffect, useRef } from "react";
import type { Session } from "../../sessions/model/session";
import { loadStopSessionsOnTabClose } from "../../sessions/model/stopOnTabClose";
import { isCodeWorkspace } from "../../projects/model/codeWorkspace";
import { listWorktrees } from "../model/worktrees";
import {
  agentWorktrees,
  closedSessionWorktrees,
  isRemovable,
  worktreeCleanupStatus,
  type CleanupCandidate,
} from "../model/worktreeCleanup";

type RemoveWorktree = (
  cwd: string,
  path: string,
  force: boolean,
  keepSessions: boolean,
) => Promise<unknown>;

/** Removes clean, merged worktrees once the last tab using them closes. */
export function useWorktreeCleanupOnClose(
  sessions: readonly Session[],
  openIds: ReadonlySet<string>,
  removeWorktree: RemoveWorktree,
) {
  const latest = useRef({ sessions, removeWorktree });
  latest.current = { sessions, removeWorktree };
  const previousOpenIds = useRef(openIds);
  const previousSessions = useRef(sessions);

  useEffect(() => {
    const closedIds = new Set([...previousOpenIds.current].filter((id) => !openIds.has(id)));
    previousOpenIds.current = openIds;
    // Removing a worktree stops its sessions: only when closing a tab already does.
    if (!closedIds.size || !loadStopSessionsOnTabClose()) return;
    // A closed tab may also unload its session; the previous render still has it.
    const current = new Set(latest.current.sessions.map((session) => session.id));
    const known = [
      ...latest.current.sessions,
      ...previousSessions.current.filter((session) => !current.has(session.id)),
    ].filter((session) => !isCodeWorkspace(session.cwd));
    void cleanUp(closedIds, openIds, known, latest.current.removeWorktree);
  }, [openIds]);

  // Declared after the effect above so it still reads the previous render's sessions.
  useEffect(() => {
    previousSessions.current = sessions;
  });
}

async function cleanUp(
  closedIds: ReadonlySet<string>,
  openIds: ReadonlySet<string>,
  sessions: readonly Session[],
  removeWorktree: RemoveWorktree,
) {
  const candidates = closedSessionWorktrees(closedIds, openIds, sessions);
  const projects = new Set(
    sessions
      .filter((session) => closedIds.has(session.id))
      .map((session) => session.cwd),
  );
  for (const cwd of projects) {
    const trees = await listWorktrees(cwd).catch(() => null);
    if (!trees) continue;
    for (const candidate of agentWorktrees(cwd, trees.worktrees, openIds, closedIds, sessions)) {
      if (!candidates.some((entry) => entry.path === candidate.path)) candidates.push(candidate);
    }
  }
  const byProject = new Map<string, CleanupCandidate[]>();
  for (const candidate of candidates) {
    byProject.set(candidate.cwd, [...(byProject.get(candidate.cwd) ?? []), candidate]);
  }
  for (const [cwd, group] of byProject) {
    const statuses = await worktreeCleanupStatus(
      cwd,
      group.map((candidate) => candidate.path),
    ).catch(() => []);
    for (const [index, candidate] of group.entries()) {
      const status = statuses[index];
      if (!status || !isRemovable(candidate, status)) continue;
      // Upstream's removal re-checks terminals, open files and changes; a refusal keeps the worktree.
      await removeWorktree(cwd, candidate.path, false, true).catch((error) =>
        console.warn(`Kept worktree ${candidate.path}:`, error),
      );
    }
  }
}
