# Branches checked out in another worktree

The branch picker tags a branch checked out in another working copy with "worktree". Picking it moves the session to that worktree instead of running a checkout git would refuse (`'main' is already used by worktree at …`). The "Switch to <default>" button hides when the default branch is checked out elsewhere.

## Fork files
- `src/features/source-control/model/branchWorktree.ts`: `worktreeHoldingBranch`, `fileSessionRoot`
- `src/features/source-control/hooks/useBranchWorktree.ts`
- `src/features/source-control/ui/BranchWorktreeChip.tsx`

## Upstream hooks
- `src/features/source-control/ui/BranchPicker.tsx`: `onSelectWorktree` prop; `branchWorktree(row.branch.name)` in `pick`; `heldBy` on `BranchList`
- `src/features/sessions/ui/Composer.tsx`: `onSelectWorktree={onWorktreeChange}` on both `BranchPicker`s (none in a code workspace)
- `src/app/App.tsx`: `seedSession(fileSessionRoot(…))` in `onCloseEveryTab` and `onCloseAllTabs`, so closing every tab around a worktree file seeds a session in the project with `worktreeCwd` instead of making the worktree its own project
- `src/features/connections/ui/RemoteSession.test.ts`: "keeps a failed host branch action in the picker" picks `feature/free`, since the fixture's `dev` lives in a worktree

## Verify
- `src/features/source-control/model/branchWorktree.test.ts`
- `src/features/source-control/ui/BranchPickerWorktree.test.ts`
- Manual: in a linked worktree session, open the branch picker; `main` shows "worktree", and picking it moves the session to the main checkout without an error.
