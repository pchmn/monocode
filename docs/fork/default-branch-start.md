# Sessions start from the default branch

A new session opened in a project fetches `origin` in the background (10 s timeout) and never moves the checkout on its own. A "New worktree" session defaults its base to the default branch and branches from `origin/<default>` on first send, fetching again only if the last fetch is over two minutes old; until the worktree exists, the turn's fold line reads "Preparing worktree…". In "Current checkout", a `↓ N` button next to the branch picker appears when the branch can fast-forward from its upstream, and pulls on click.

## Fork files
- `src-tauri/src/default_branch_start.rs`: `default_branch_fetch` (with timeout), `default_branch_start`, `branch_behind_upstream`
- `src/features/source-control/model/defaultBranchStart.ts`: which sessions qualify, fetch freshness, `freshWorktreeBase`
- `src/features/source-control/hooks/useDefaultBranchOnOpen.ts`: fetches for sessions created or moved into a project after launch
- `src/features/source-control/hooks/useDefaultBranch.ts`
- `src/features/source-control/ui/BranchSyncButton.tsx`

## Upstream hooks
- `src/app/App.tsx`: `useDefaultBranchOnOpen(sessions)` after `useAgentWorktreeAdoption`; `freshWorktreeBase` as the base of the draft worktree `createWorktree`
- `src/features/sessions/ui/Composer.tsx`: `useDefaultBranch`, preferred over the current branch in `resolvedWorktreeBase` and the `worktreeBase === "HEAD"` effect; `BranchSyncButton` after both `BranchPicker`s
- `src/features/sessions/ui/AgentTranscript.tsx`: `preparingLabel` prop, shown in place of `LiveFoldTitle`
- `src/features/sessions/ui/SessionPane.tsx`: `preparingLabel` from `session.worktreePreparing`
- `src-tauri/src/lib.rs`: `mod default_branch_start` and its four commands in the invoke handler

## Verify
- `src/features/source-control/model/defaultBranchStart.test.ts`
- `cargo test default_branch_start`
- Manual: on a clean `main` one commit behind `origin/main`, open a new session. The checkout stays put and `↓ 1` appears next to the branch picker; clicking it fast-forwards and the button disappears. Switch to "New worktree" and send: the fold line reads "Preparing worktree…", and the worktree starts at `origin/main`.
