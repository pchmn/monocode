# Session card on title tabs

A title tab shows its focused session's linked issue or PR icon at the tab's right edge, however short the title (a PR's tinted by its state, as in the sidebar), and hovering the tab for 400 ms opens the same session card as the sidebar, below the tab; moving along the tabs swaps cards straight away. The card stays open while the pointer is over the tab, the card, or the gap between them, decided from the pointer's position so a busy main thread cannot close it mid-crossing. Only sessions of the sidebar's project have a card.

## Fork files
- `src/features/sessions/model/tabSessionSummaries.ts` — App publishes the sidebar's session summaries; tabs read theirs by id
- `src/features/sessions/ui/TitleTabSessionHover.tsx` — icon, hover timing, hides the tab's native tooltip while hovered
- `src/features/sessions/model/hoverBridge.ts` — tab, card and gap hit test

## Upstream hooks
- `src/app/App.tsx` — `usePublishTabSessionSummaries(sidebarHistory)`, `sessionId: focused?.id` in `toTitleTab`
- `src/app/shell/TitleBar.tsx` — `sessionId` on `Tab`, `<TitleTabSessionHover tab={tab} />` after the tab's `TabLabel`
- `src/features/sessions/ui/SessionCardPreview.tsx` — `side` prop (defaults to `right`)

## Verify
- `src/features/sessions/model/hoverBridge.test.ts`
- Manual: inset layout, a session linked to an issue: its tab shows the issue icon. Hover the tab: after a short delay the card opens below it with branch, worktree and the linked item; slide to the next tab and its card replaces it at once; click the tab and the card closes. While the agent is working in that tab, move slowly from the tab onto the card: it stays open.
