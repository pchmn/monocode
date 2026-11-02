import type { Worktree } from "../model/worktrees";

export function BranchWorktreeChip({ tree }: { tree?: Worktree }) {
  if (!tree) return null;
  return (
    <span
      title={`Checked out in ${tree.path}`}
      className="shrink-0 rounded bg-content/6 px-1.5 py-0.5 text-[10px] text-content/40"
    >
      worktree
    </span>
  );
}
