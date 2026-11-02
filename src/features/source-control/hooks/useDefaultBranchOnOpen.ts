import { useEffect, useRef } from "react";
import { notifyGitChanged } from "../../../platform/tauri/fs";
import { projectWorkDir } from "../../projects/model/codeWorkspace";
import type { Session } from "../../sessions/model/session";
import {
  checkoutInUse,
  fetchDefaultBranch,
  startFromDefaultBranch,
  startsFromDefaultBranch,
} from "../model/defaultBranchStart";

/** Fetches when a session opens in a project, and moves an idle checkout to the default branch. */
export function useDefaultBranchOnOpen(sessions: readonly Session[]) {
  const latest = useRef(sessions);
  latest.current = sessions;
  // Sessions restored at launch already chose their branch.
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    const key = (session: Session) => `${session.id}\0${session.cwd}`;
    if (!seen.current) {
      seen.current = new Set(sessions.map(key));
      return;
    }
    for (const session of sessions) {
      if (seen.current.has(key(session))) continue;
      seen.current.add(key(session));
      if (!startsFromDefaultBranch(session)) continue;
      const cwd = projectWorkDir(session.cwd);
      void fetchDefaultBranch(cwd)
        .then(() => {
          const current = latest.current.find((s) => s.id === session.id);
          const checkout =
            !!current &&
            current.cwd === session.cwd &&
            current.workspaceMode !== "worktree" &&
            startsFromDefaultBranch(current) &&
            !checkoutInUse(latest.current, current);
          return startFromDefaultBranch(cwd, checkout);
        })
        .then(() => notifyGitChanged())
        .catch(() => undefined);
    }
  }, [sessions]);
}
