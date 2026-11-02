# Swap side panels (inset layout)

Settings › Appearance › "Swap side panels": Explorer/Changes/History on the left, sessions on the right. In the inset layout the right panel sits outside the card. (PRs #13, #15)

## Fork files
- `src/features/settings/model/panelSide.ts` — `usePanelsSwapped`, `resizeDirection`, `useToolsPanelWidthVar`
- `src/styles/swapPanels.css` — keyed on the `panels-swapped` class on `<html>`

## Upstream hooks
- `src/main.tsx` — `import "./styles/swapPanels.css"`
- `src/app/App.tsx` — `resizeDirection("tools", panelsSwapped)` for the right-panel resize; the inset right panel (`setRightPanelRef`, `aria-label="Project tools"`) moved out of the card, after it, without its `border-l`
- `src/app/shell/Sidebar.tsx` — `resizeDirection("sessions", usePanelsSwapped())` in the sessions resize
- `src/app/shell/TitleBar.tsx` — `sessionToggleRight`, `rightPanelButton` extracted and the sidebar toggle swapped side, `useToolsPanelWidthVar`
- `src/features/settings/ui/SettingsView.tsx` — "Swap side panels" row (inset only)

## Verify
- `src/features/settings/model/panelSide.test.ts`
- Manual: inset layout, toggle the setting; both panels swap sides and both still resize by dragging toward the card.
