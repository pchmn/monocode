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
