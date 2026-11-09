# Working panel tweaks

The sidebar's Working panel (`LiveAgentsPreview`) shows as soon as an agent runs outside the active session (upstream needs two agents), and its cards truncate long text. Its header folds the card list, showing the count and an amber dot while an agent needs approval. Every agent is listed in a scroll area about four cards tall, replacing upstream's four-card cap and "N more" button; a fade on the cut-off edge and a "↓ N more" pill (scrolls down) show what's hidden. When agents span several projects, they are grouped under foldable project headers (folded state kept per project, amber dot while folded) and the cards drop their project line. (PRs #14, #38)

## Fork files
- `src/features/sessions/model/workingPanelCollapsed.ts` — `useWorkingPanelCollapsed`
- `src/features/sessions/ui/WorkingPanelHeader.tsx`
- `src/features/sessions/ui/WorkingAgentList.tsx` — scroll area, edge fade, "N more" pill
- `src/features/sessions/model/workingAgentGroups.ts` — `groupAgentsByProject`, `useCollapsedProjects`
- `src/features/sessions/ui/WorkingAgentGroups.tsx` — project accordion

## Upstream hooks
- `src/features/sessions/ui/LiveAgentsPreview.tsx` — `shown` (any agent other than `activeSessionId`) replacing `LIVE_AGENT_MIN`; `min-w-0 overflow-hidden` / `w-full` classes in `LiveAgentCard`; `WorkingPanelHeader` replaces the header row, `collapsed` hides the list; the cards render inside `WorkingAgentList` (replacing the list `div` and its `useLockOverscroll`) (`LIVE_AGENT_CAP`, `expanded` and the "more" button removed); `WorkingAgentGroups` wraps the card map via `renderCard`; `hideProject` prop on `LiveAgentCard`; `flex min-h-0 flex-col` on the section and its card box (was `shrink-0`) so the list shrinks when the sidebar runs out of room, and `shrink-0` on `LiveAgentCard` so the cards keep their three lines and the list scrolls instead
- `src/features/sessions/ui/LiveAgentsPreview.test.ts` — "shows only when an agent runs outside the active session"; "groups agents by project…" (was the four-agent cap), "folds a project group…", "lists a single project flat…"

## Verify
- `src/features/sessions/ui/LiveAgentsPreview.test.ts`
- Manual: click "Working"; the cards fold, the state survives a reload. With 5+ agents, the list scrolls with the wheel (every card keeps its harness/elapsed line, even in a short sidebar), the bottom fades with a "↓ N more" pill until the end, and the top fades once scrolled. With agents in 2+ projects, each project header folds its cards and the state survives a reload.
