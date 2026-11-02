import { useEffect, useRef } from "react";
import { notifyGitChanged } from "../../../platform/tauri/fs";
import { projectWorkDir } from "../../projects/model/codeWorkspace";
import type { Session } from "../../sessions/model/session";
import {
  fetchDefaultBranch,
  startsFromDefaultBranch,
} from "../model/defaultBranchStart";

/** Fetches when a session opens in a project; the checkout itself only moves on request. */
export function useDefaultBranchOnOpen(sessions: readonly Session[]) {
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
        .then(() => notifyGitChanged({ cwd }))
        .catch(() => undefined);
    }
  }, [sessions]);
}
