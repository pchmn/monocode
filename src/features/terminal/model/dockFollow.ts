import {
  addTerminalToDock,
  nextDockTerminalTitle,
  selectDockTerminal,
  type ProjectTerminalDock,
} from "../../projects/model/projectTerminal";
import { sameProjectPath } from "../../projects/model/recents";
import {
  newTerminalFile,
  type FilePaneTab,
} from "../../workspace/model/layout";

// A terminal's cwd moves with `cd`; matching on where it started keeps it tied to its session.
const launchCwds = new Map<string, string>();

function launchCwd(file: FilePaneTab): string {
  let cwd = launchCwds.get(file.id);
  if (!cwd) {
    cwd = file.cwd;
    launchCwds.set(file.id, cwd);
  }
  return cwd;
}

function opensIn(file: FilePaneTab, cwd: string): boolean {
  return (
    !!file.terminal &&
    (sameProjectPath(launchCwd(file), cwd) || sameProjectPath(file.cwd, cwd))
  );
}

/** Shows the dock terminal opened in `cwd`, opening one there when none is. */
export function followDockToCwd(
  dock: ProjectTerminalDock,
  cwd: string,
): ProjectTerminalDock {
  const { files, activeFileId } = dock.pane;
  files.forEach(launchCwd);
  const current = files.find((file) => file.id === activeFileId);
  if (current && opensIn(current, cwd)) return dock;
  const match = files.find((file) => opensIn(file, cwd));
  if (match) return selectDockTerminal(dock, match.id);
  const file = newTerminalFile(
    cwd,
    nextDockTerminalTitle(dock, cwd),
    dock.projectPath,
  );
  launchCwds.set(file.id, cwd);
  return addTerminalToDock(dock, file);
}
