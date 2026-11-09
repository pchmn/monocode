# Stacked side panels

Settings › Appearance › "Stack side panels" (inset layout): Explorer/Changes/History sit under the sessions in one sidebar, the app views move into the sidebar header, and the Working panel stays at the bottom. (PRs #30, #32, #36)

## Fork files
- `src/features/settings/model/stackedPanels.ts` — `useStackedPanels`, tools height persistence
- `src/app/shell/StackedToolsPane.tsx` — resizable host for the tools under the sessions; near-zero `flex-shrink` so the Working list gives way first
- `src/app/shell/SidebarNavRow.tsx` — replaces upstream `SidebarNavList` (removed from `Sidebar.tsx`), icons in the header when stacked

## Upstream hooks
- `src/app/shell/Sidebar.tsx` — `stacked` / `stackedHost` / `toolsHost` (portal target for the tools pane), `navIconsHost`, `SidebarNavRow` in place of `SidebarNavList`, `onSearch` hidden when stacked, `<StackedToolsPane>` placement relative to the Working panel
- `src/app/App.tsx` — `!stackedPanels &&` on the right panel's visibility
- `src/features/settings/ui/SettingsView.tsx` — "Stack side panels" row (inset only)

## Verify
- `src/features/settings/model/stackedPanels.test.ts`
- Manual: inset layout, enable the setting; the tools appear under the sessions with a resize handle, view icons in the sidebar header, the Working panel below everything. Drag the tools to their max, then run agents and switch sessions from the Working panel: the tools keep their height, the Working list scrolls instead.
