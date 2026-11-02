# Sessions start from the default branch

A new session opened in a project fetches `origin` and starts from its default branch. A "New worktree" session defaults its base to that branch and branches from `origin/<default>` on first send. A "Current checkout" session switches the checkout to the default branch and fast-forwards it, only when the checkout is clean, has no merge or rebase in progress, and no other session is running on it. Otherwise the checkout stays where it is.

## Fork files
- `src-tauri/src/default_branch_start.rs`: `default_branch_fetch`, `default_branch_start` (switch, then `merge --ff-only`)
- `src/features/source-control/model/defaultBranchStart.ts`: which sessions qualify, `freshWorktreeBase`
- `src/features/source-control/hooks/useDefaultBranchOnOpen.ts`: acts on sessions created or moved into a project after launch
- `src/features/source-control/hooks/useDefaultBranch.ts`

## Upstream hooks
- `src/app/App.tsx`: `useDefaultBranchOnOpen(sessions)` after `useAgentWorktreeAdoption`; `freshWorktreeBase` as the base of the draft worktree `createWorktree`
- `src/features/sessions/ui/Composer.tsx`: `useDefaultBranch`, preferred over the current branch in `resolvedWorktreeBase` and the `worktreeBase === "HEAD"` effect
- `src-tauri/src/lib.rs`: `mod default_branch_start` and its three commands in the invoke handler

## Verify
- `src/features/source-control/model/defaultBranchStart.test.ts`
- `cargo test default_branch_start`
- Manual: with the project checkout clean on a feature branch, open a new session. The branch picker switches to `main`, now level with `origin/main`. Switch to "New worktree": the base shows `main`, and the worktree created on send starts at `origin/main`.
