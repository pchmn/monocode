# AGENTS.md

This repository is a **fork** of [hardbeat920/monocode](https://github.com/hardbeat920/monocode) (the `upstream` remote). It is regularly rebased or merged onto upstream, so every change here is judged by one extra criterion: how cheaply it survives the next upstream merge.

## Keep fork changes isolated

- Put fork behaviour in **new files**, inside the feature folder it belongs to (`src/features/<feature>/model`, `ui`, `hooks`). Upstream files get only thin **hooks**: an import, a prop, a one-line branch, a call into the new module.
- Move state, helpers and components out of upstream files instead of growing them. A component that owns its own state needs no props threaded through `App.tsx` or `Sidebar.tsx`.
- Reuse upstream mechanisms as they are (stores, models, callbacks an upstream component already receives) rather than reshaping them for the fork.
- Treat the large shared files as the most conflict-prone: `src/app/App.tsx`, `src/app/shell/Sidebar.tsx`, `src/features/sessions/ui/Composer.tsx`, `src/features/files/ui/FileTree.tsx`. Touch them last and least.
- Keep the diff of an upstream file limited to the lines the change needs. Many upstream files are not Prettier- or rustfmt-clean: format only your own lines, never the whole file, and avoid edits that re-indent existing blocks.
- Before opening a PR, check the footprint with `git diff --stat main` and move logic out of any upstream file that grew by more than a few lines.

Reference example: VS Code workspace support lives in `src/features/projects/model/codeWorkspace.ts` and `src/features/projects/ui/WorkspaceFolder*.tsx`, with small hooks in upstream files.

## Branching

One branch per change, cut from up-to-date `main`: `<type>/<slug>`, where `<type>` is the conventional-commit type of the work (`feat/collapsible-monos`). Implementation commits land on that branch, never directly on `main`.

Work in a worktree, never by switching branches in the main checkout: another session may be working there. A local `main` lags behind the PRs merged since, so run `git fetch origin` first and start from `origin/main`; only work that builds on another branch starts from that branch.

- **Already in a linked worktree** (`git rev-parse --git-dir` differs from `git rev-parse --git-common-dir`; MonoCode creates one per session on request): work there. Rename a MonoCode branch (`mc/…`) with `git branch -m <type>/<slug>`, and while it has no commit of its own, `git rebase origin/main`: MonoCode cuts it from the main checkout's `HEAD`.
- **In the main checkout**: create one named after the branch, `git worktree add .worktrees/<slug> -b <type>/<slug> origin/main`.

Worktrees are removed when their session's tab closes, once clean and merged ([`docs/fork/worktree-cleanup.md`](docs/fork/worktree-cleanup.md)): leave them in place.

## Fork manifest

[`docs/fork/`](docs/fork/README.md) has one entry per fork feature: its upstream hooks and how to verify it. Read it when you change fork behaviour (update the feature's entry in the same PR) and when you sync with upstream (run its sync check).
