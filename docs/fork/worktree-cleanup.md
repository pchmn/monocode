# Worktree cleanup on tab close

When a session's tab closes (and "Stop sessions when closing their tab" is on), its worktree is removed if no open session uses it, it has no local changes, and its branch is integrated into `origin`'s default branch (squash merges included). Worktrees agents created under `.worktrees/` are swept at the same time, once they have commits, all integrated, and no other session of the project is running. Anything else is kept. (PR #TBD)

## Fork files
- `src-tauri/src/worktree_cleanup.rs` — `worktree_cleanup_status`: fetch, clean check, `merge-tree` integration check
- `src/features/source-control/model/worktreeCleanup.ts` — candidate selection, `isRemovable`
- `src/features/source-control/hooks/useWorktreeCleanupOnClose.ts` — detects closed tabs, calls upstream `onRemoveWorktree` with `keepSessions`

## Upstream hooks
- `src/app/App.tsx` — `useWorktreeCleanupOnClose(sessions, tabSessionIds, onRemoveWorktree)` right after `onRemoveWorktree`
- `src-tauri/src/lib.rs` — `mod worktree_cleanup`, `worktree_cleanup_status` in the invoke handler
- `src/features/settings/ui/SettingsView.tsx` — stop-on-tab-close description mentions the worktree
- `src/features/settings/model/settings.ts` — `worktree cleanup` keywords on `stop-sessions-on-tab-close`

## Verify
- `src/features/source-control/model/worktreeCleanup.test.ts`
- `cargo test worktree_cleanup`
- Manual: start a session in a new worktree, close its tab without changes; the worktree disappears from the switcher and `git worktree list`.
