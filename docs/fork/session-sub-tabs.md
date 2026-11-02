# Session and files as sub-tabs

A third file-tab mode, "Sub-tabs": a session and the file pane beside it share the full width, switched by a sub-tab row, and the top tab is titled by the session. A toggle in the file pane switches between "beside chat" and sub-tabs. (PRs #10, #11, #12, #37, #40, #41, #42)

## Fork files
- `src/features/workspace/model/stackedLayout.ts` — `stackedPair`, `stackedSurface`, `sessionTitleMode`
- `src/features/workspace/ui/StackedTabs.tsx` — the sub-tab row
- `src/features/workspace/ui/FileTabModeToggle.tsx`

## Upstream hooks
- `src/features/settings/model/settings.ts` — `"stacked"` in `FileTabMode` and `loadFileTabMode`, change event in `saveFileTabMode`, `subscribeFileTabMode`
- `src/features/settings/ui/SettingsView.tsx` — `"stacked"` / "Sub-tabs" option of the file-tab mode row
- `src/features/workspace/ui/PaneTree.tsx` — `stackedMode` / `stacked` / `stackedLeafId`, no sashes or slide animation while stacked, `stackHidden` leaves, `stackable` on `FilePane`, `StackedTabs` wrapper around `treeElement`
- `src/features/workspace/ui/SurfaceTabs.tsx` — `leading` prop
- `src/features/files/ui/FilePane.tsx` — `stackable` prop rendering `FileTabModeToggle` as `trailing` (and in the memo comparator)
- `src/app/App.tsx` — `sessionTitleMode` in `toTitleTab` (`files` / `fileFocused` overridden)
- `src/shared/ui/icons.tsx` — `Layout` icon used by `FileTabModeToggle`

## Verify
- `src/features/workspace/model/stackedLayout.test.ts`
- Manual: set File tabs to Sub-tabs, open a file from a session; session and file switch as sub-tabs, the top tab keeps the session title.
