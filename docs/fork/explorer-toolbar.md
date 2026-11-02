# Explorer actions on the root row

New File / New Folder / Collapse All / Search sit on the explorer's root row instead of a separate header, and work per folder in a VS Code workspace. (PR #24)

## Fork files
- `src/features/files/ui/ExplorerToolbar.tsx` — `ExplorerToolbar`, `ExplorerActions`

## Upstream hooks
- `src/features/files/ui/FileTree.tsx` — `PaneHeader` and `HeaderIcon` removed; `actions` object exposed through `actionsRef` (`useImperativeHandle`); `<ExplorerToolbar>` on the root row

## Verify
- Manual: the explorer root row shows the four actions; New File creates at the root, Collapse All folds the tree.
