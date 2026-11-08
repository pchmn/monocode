# Checkout and worktree icons

Checkouts show a git-folder icon and worktrees a hierarchy-files icon, wherever upstream used a plain folder or folder-tree icon for them. (PR #65)

## Upstream hooks
- `src/shared/ui/icons.tsx` — `FolderGit` and `Worktree` exports
- `src/features/workspace/ui/WorkspacePicker.tsx` — `FolderGit as Folder`, `Worktree as FolderTree` imports
- `src/app/shell/SettingsRail.tsx`, `src/features/monos/ui/MonoChangesView.tsx`, `src/features/quick-composer/ui/QuickWorkspaceControls.tsx`, `src/features/source-control/ui/GitPickerTrigger.tsx`, `src/features/source-control/ui/SidebarWorktreeSwitcher.tsx`, `src/features/source-control/ui/WorktreePicker.tsx`, `src/features/source-control/ui/WorktreesPage.tsx`, `src/features/source-control/ui/Worktrees.test.ts` — `Worktree as FolderTree` import

## Verify
- `src/features/source-control/ui/Worktrees.test.ts`
- Manual: open the workspace picker; the checkout shows a git-folder icon and each worktree a hierarchy icon.
