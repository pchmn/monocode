# Session card on title tabs

A title tab shows its focused session's linked issue or PR icon after the title, and hovering the tab for 400 ms opens the same session card as the sidebar, below the tab; moving along the tabs swaps cards straight away. Only sessions of the sidebar's project have a card.

## Fork files
- `src/features/sessions/model/tabSessionSummaries.ts` — App publishes the sidebar's session summaries; tabs read theirs by id
- `src/features/sessions/ui/TitleTabSessionHover.tsx` — icon, hover timing, hides the tab's native tooltip while hovered

## Upstream hooks
- `src/app/App.tsx` — `usePublishTabSessionSummaries(sidebarHistory)`, `sessionId: focused?.id` in `toTitleTab`
- `src/app/shell/TitleBar.tsx` — `sessionId` on `Tab`, `<TitleTabSessionHover tab={tab} />` after the tab's `TabLabel`
- `src/features/sessions/ui/SessionCardPreview.tsx` — `side` prop (defaults to `right`)

## Verify
- Manual: inset layout, a session linked to an issue: its tab shows the issue icon. Hover the tab: after a short delay the card opens below it with branch, worktree and the linked item; slide to the next tab and its card replaces it at once; click the tab and the card closes.
