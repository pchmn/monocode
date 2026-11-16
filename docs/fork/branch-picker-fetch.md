# Branch picker fetches remote branches

Opening the branch picker in a local project fetches `origin` in the background (10 s timeout, at most once a minute per project), then reloads the list, so a branch pushed since the last fetch is offered as `origin/<name>` and checks out as a tracking branch. While the fetch runs, an empty list reads "Fetching remote branches…".

## Fork files
- `src/features/source-control/hooks/useBranchPickerFetch.ts` — reuses `fetchDefaultBranch` (`default_branch_fetch`) and `notifyGitChanged`

## Upstream hooks
- `src/features/source-control/ui/BranchPicker.tsx` — `useBranchPickerFetch(cwd, inProject && open)`, its `fetching` in the list's `emptyLabel`

## Verify
- Manual: push a branch from another clone (or have a teammate open a PR), then in MonoCode open the branch picker and type its name: "Fetching remote branches…" shows for a moment, then the branch appears with its `origin` tag; picking it checks out a local tracking branch.
