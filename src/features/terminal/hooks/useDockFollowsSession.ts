import { useEffect, type Dispatch, type SetStateAction } from "react";
import {
  findProjectTerminal,
  type ProjectTerminalDock,
} from "../../projects/model/projectTerminal";
import { isLocalProject, sameProjectPath } from "../../projects/model/recents";
import { sessionWorkCwd } from "../../sessions/model/session";
import { followDockToCwd } from "../model/dockFollow";

/** Keeps the open project dock on a terminal in the active session's folder. */
export function useDockFollowsSession(
  projectPath: string,
  session:
    | { cwd: string; worktreeCwd?: string; worktreeRemoved?: boolean }
    | undefined,
  docks: ProjectTerminalDock[],
  setDocks: Dispatch<SetStateAction<ProjectTerminalDock[]>>,
): void {
  const target =
    session && !session.worktreeRemoved ? sessionWorkCwd(session) : null;
  const dockOpen = !!findProjectTerminal(docks, projectPath)?.open;
  useEffect(() => {
    if (!dockOpen || !target || !isLocalProject(projectPath)) return;
    setDocks((prev) => {
      let changed = false;
      const next = prev.map((dock) => {
        if (!sameProjectPath(dock.projectPath, projectPath)) return dock;
        const followed = followDockToCwd(dock, target);
        if (followed !== dock) changed = true;
        return followed;
      });
      return changed ? next : prev;
    });
  }, [projectPath, target, dockOpen, setDocks]);
}
