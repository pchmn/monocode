# Git spawn performance

`git` runs from an absolute path with no `pre_exec`, so Rust uses `posix_spawn` instead of `fork()` (upstream #1132), and git-changed events carry a `cwd` so only that project's listeners refresh. (PR #17)

## Upstream hooks
- `src-tauri/src/fs.rs` — `git_cmd` (now `pub(crate)`, resolved once via `which_in_path`, no `configure_child`)
- `src-tauri/src/harness.rs` — `which_in_path` made `pub(crate)`
- `src/platform/tauri/fs.ts` — `notifyGitChanged({ cwd })` dispatches a `CustomEvent`; `subscribeGitChanged(listener, cwd)` filters with `samePathTree`
- `src/app/App.tsx` — `notifyGitChanged({ cwd })` in `nudgeOpenEditors`
- `src/features/source-control/hooks/useGitFileStatuses.ts`, `src/features/source-control/hooks/useProjectBranches.ts`, `src/features/source-control/hooks/useProjectDiffStats.ts`, `src/features/source-control/ui/GitChangesPanel.tsx` — `cwd` passed to `subscribeGitChanged` / `notifyGitChanged`

## Verify
- `src/platform/tauri/fs.test.ts` — "scopes git-changed events to the matching project tree"
- Check upstream #1132: if upstream fixed the spawn path its own way, drop the Rust part.
