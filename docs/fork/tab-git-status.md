# Git status colour on file tabs

A file tab's name takes the explorer's git colour (modified, added, untracked, deleted). Problems keep their red, which wins.

## Fork files
- `src/features/files/ui/GitTintedTabLabel.tsx` — reads the explorer's `useGitFileStatuses` cache, from the matching folder in a VS Code workspace

## Upstream hooks
- `src/features/workspace/ui/SurfaceTabs.tsx` — `GitTintedTabLabel` replaces `TabLabel` for the tab name

## Verify
- Manual: edit and save an open file; its tab turns amber like its explorer row, and goes back to normal after a commit or a discard. Same check on a file of a VS Code workspace folder.
