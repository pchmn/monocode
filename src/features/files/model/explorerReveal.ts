import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";
import { isEqualOrInside, parentPath, pathKey } from "../../../shared/lib/paths";
import type { FilePaneTab } from "../../workspace/model/layout";

const ROW_WAIT_MS = 2000;

let target: string | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function isPlainFile(file: FilePaneTab): boolean {
  return !(
    file.terminal ||
    file.agent ||
    file.plan ||
    file.releaseNotes ||
    file.commit ||
    file.sessionChanges ||
    file.changes
  );
}

/** Points the explorer at the focused file each time a different one gets focus. */
export function useExplorerRevealSource(file: FilePaneTab | undefined) {
  const path = file && isPlainFile(file) ? file.path : undefined;
  useEffect(() => {
    if (!path || path === target) return;
    target = path;
    for (const listener of listeners) listener();
  }, [path]);
}

/** The folders to expand, root first, for `path` to show under `root`; null when outside it. */
export function revealDirs(root: string, path: string): string[] | null {
  if (pathKey(path) === pathKey(root) || !isEqualOrInside(path, root)) return null;
  const dirs: string[] = [];
  for (let dir = parentPath(path); ; dir = parentPath(dir)) {
    dirs.unshift(dir);
    if (pathKey(dir) === pathKey(root) || parentPath(dir) === dir) break;
  }
  return dirs;
}

export function useRevealInTree(
  cwd: string,
  rootRef: RefObject<HTMLElement | null>,
  expandDirs: (dirs: string[]) => void,
  select: (path: string) => void,
) {
  const path = useSyncExternalStore(subscribe, () => target);
  const handlers = useRef({ expandDirs, select });
  handlers.current = { expandDirs, select };

  useEffect(() => {
    if (!path) return;
    const dirs = revealDirs(cwd, path);
    if (!dirs) return;
    handlers.current.expandDirs(dirs);
    handlers.current.select(path);
    // Rows of folders not listed yet appear only once their listing resolves.
    const until = performance.now() + ROW_WAIT_MS;
    let frame = 0;
    const scroll = () => {
      const row = rootRef.current?.querySelector<HTMLElement>(
        `[role='treeitem'][title="${CSS.escape(path)}"]`,
      );
      if (row) row.scrollIntoView({ block: "nearest" });
      else if (performance.now() < until) frame = requestAnimationFrame(scroll);
    };
    frame = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(frame);
  }, [cwd, path, rootRef]);
}
