import { useCallback } from "react";
import { worktreeHoldingBranch } from "../model/branchWorktree";
import { useProjectWorktrees } from "./useProjectWorktrees";

export function useBranchWorktree(cwd: string, enabled = true) {
  const { data } = useProjectWorktrees(cwd, enabled);
  return useCallback(
    (branch: string) => worktreeHoldingBranch(data?.worktrees, branch, cwd),
    [data, cwd],
  );
}
