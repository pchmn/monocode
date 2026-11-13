# Explorer follows the focused file

Focusing a file tab expands the explorer down to that file, selects it and scrolls it into view, in every folder tree of a VS Code workspace too. It happens once per newly focused file, so folders collapsed afterwards stay collapsed.

## Fork files
- `src/features/files/model/explorerReveal.ts` — focused-file store (`useExplorerRevealSource`), `revealDirs`, `useRevealInTree`

## Upstream hooks
- `src/app/App.tsx` — `useExplorerRevealSource(activeFile)`
- `src/features/files/ui/FileTree.tsx` — `useRevealInTree(cwd, rootRef, expandDirs, onSelect)`

## Verify
- `src/features/files/model/explorerReveal.test.ts`
- Manual: with deep folders collapsed, open a nested file from Go to File; the Explorer expands to it and highlights it.
