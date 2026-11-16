# Working panel tweaks

The sidebar's Working panel (`LiveAgentsPreview`) shows as soon as an agent runs outside the active session (upstream needs two agents). Its header folds the card list, showing the count and an amber dot while an agent needs approval. Every agent is listed in a scroll area about four cards tall, replacing upstream's four-card cap and "N more" button; a fade on the cut-off edge and a "↓ N more" pill (scrolls down) show what's hidden.

Agents are triaged: **Needs you** (approval or unseen finish) comes first as two-line cards (project mascot, title, elapsed / status and activity, amber tint for approvals); **Running** follows as one-line rows (live glyph — spinner or background dot —, title, elapsed, harness), grouped by project under a mascot heading a project-colored rail, drawn only for 2+ agents. The running activity and project name are in the row's tooltip and `aria-label`. Section labels only show when both sections are non-empty. (PRs #14, #38)

## Fork files
- `src/features/sessions/model/workingPanelCollapsed.ts` — `useWorkingPanelCollapsed`
- `src/features/sessions/ui/WorkingPanelHeader.tsx`
- `src/features/sessions/ui/WorkingAgentList.tsx` — scroll area, edge fade, "N more" pill
- `src/features/sessions/model/workingAgentGroups.ts` — `groupAgentsByProject`
- `src/features/sessions/model/workingAgentTriage.ts` — `triageAgents`
- `src/features/sessions/ui/WorkingAgentTriage.tsx` — sections, attention cards, running rail rows

## Upstream hooks
- `src/features/sessions/ui/LiveAgentsPreview.tsx` — `shown` (any agent other than `activeSessionId`) replacing `LIVE_AGENT_MIN`; `WorkingPanelHeader` replaces the header row, `collapsed` hides the list; `WorkingAgentList` replaces the list `div` and its `useLockOverscroll` (`LIVE_AGENT_CAP`, `expanded` and the "more" button removed); `WorkingAgentTriage` replaces the card map, and upstream's `LiveAgentCard` is removed (on upstream merges, port card changes to `WorkingAgentTriage.tsx`); `flex min-h-0 flex-col` on the section and its card box (was `shrink-0`) so the list shrinks when the sidebar runs out of room
- `src/features/sessions/ui/LiveAgentsPreview.test.ts` — "shows only when an agent runs outside the active session"; "lists agents that need the user first…" (was the four-agent cap), "drops the section labels…"; the background-task test reads `aria-label`
- `src/app/shell/SidebarRename.test.ts` — "sidebar working agents": the two-project preview checks the `[data-working-group]` rail titles instead of per-card project lines

## Verify
- `src/features/sessions/ui/LiveAgentsPreview.test.ts`
- Manual: click "Working"; the cards fold, the state survives a reload. With an approval and running agents, "Needs you" lists the approval first, "Running" groups the rest by project; a project with one running agent shows its mascot without a rail. Running rows keep their spinner and harness icon aligned whatever the elapsed time. With 5+ agents, the list scrolls with the wheel, the bottom fades with a "↓ N more" pill until the end, and the top fades once scrolled.
