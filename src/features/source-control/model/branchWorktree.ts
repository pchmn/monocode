import { pathKey } from "../../../shared/lib/paths";
import type { Worktree } from "./worktrees";

/** The other working copy that has `branch` checked out: git refuses to check it out here. */
export function worktreeHoldingBranch(
  worktrees: readonly Worktree[] | undefined,
  branch: string,
  cwd: string,
): Worktree | undefined {
  return worktrees?.find(
    (tree) =>
      tree.branch === branch &&
      !tree.missing &&
      pathKey(tree.path) !== pathKey(cwd),
  );
}

export function branchHeldMessage(branch: string, tree: Worktree): string {
  return `${branch} is checked out in ${tree.path}.`;
}

/** Session roots for a file tab, keeping a worktree file's owning project as the project. */
export function fileSessionRoot(
  file: { cwd: string; projectCwd?: string } | undefined,
  fallback: string,
): { cwd: string; worktreeCwd?: string } {
  if (!file?.cwd) return { cwd: fallback };
  const cwd = file.projectCwd ?? file.cwd;
  return pathKey(cwd) === pathKey(file.cwd)
    ? { cwd }
    : { cwd, worktreeCwd: file.cwd };
}
