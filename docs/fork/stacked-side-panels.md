# Stacked side panels

Settings › Appearance › "Stack side panels" (inset layout): the sidebar switches between Sessions, Files, Changes and History with icon tabs under its header, each one full height; the active tab widens into a pill with its label, the others show a tooltip, an amber dot when a session needs you and the changed-file count on Changes. Sessions is the right panel closed, the other tabs are the right panel open on that tool, so the panel shortcut and the saved tab keep working; the title bar's panel toggle is hidden. The app views move into the sidebar header, and the Working panel stays at the bottom. (PRs #30, #32, #36)

## Fork files
- `src/features/settings/model/stackedPanels.ts` — `useStackedPanels`
- `src/app/shell/SidebarModeTabs.tsx` — the tab row; follows the right panel's tab order
- `src/app/shell/StackedToolsPane.tsx` — host for the tools in place of the session list
- `src/app/shell/SidebarNavRow.tsx` — replaces upstream `SidebarNavList` (removed from `Sidebar.tsx`), icons in the header when stacked

## Upstream hooks
- `src/app/shell/Sidebar.tsx` — `stacked` / `stackedHost` / `toolsHost` (portal target for the tools pane), `navIconsHost`, `SidebarNavRow` in place of `SidebarNavList`, `onSearch` hidden when stacked, `<SidebarModeTabs>` under `workspaceHeader` (with `changedFiles` and `sessionsNeedYou`), `!(stacked && paneTab)` hiding the session list, `<StackedToolsPane>`, `hideTabs` on `RightPanel`, `onToggle` in the `rightPanel` prop
- `src/app/App.tsx` — `!stackedPanels &&` on the right panel's visibility, `onToggle: onToggleRightPanel` in `rightPanel`, `!stackedPanels` on `onToggleRightPanel` passed to `TitleBar`
- `src/features/settings/ui/SettingsView.tsx` — "Stack side panels" row (inset only)

## Verify
- Manual: inset layout, enable the setting; the sidebar shows the tab row under its header. Files, Changes and History each fill the sidebar, Sessions brings the list back, the title bar has no panel toggle, and its shortcut switches between Sessions and the last tool. The active Changes tab shows its `+N` additions, inactive it shows the changed-file count; finish or block a session from another tab and the Sessions icon gets an amber dot; reordering is no longer offered, the tabs follow the saved right panel order.
