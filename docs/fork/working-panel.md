# Working panel tweaks

The sidebar's Working panel (`LiveAgentsPreview`) shows as soon as an agent runs outside the active session (upstream needs two agents), and its cards truncate long text. (PRs #14, #38)

## Upstream hooks
- `src/features/sessions/ui/LiveAgentsPreview.tsx` — `shown` (any agent other than `activeSessionId`) replacing `LIVE_AGENT_MIN`; `min-w-0 overflow-hidden` / `w-full` classes in `LiveAgentCard`
- `src/features/sessions/ui/LiveAgentsPreview.test.ts` — "shows only when an agent runs outside the active session"

## Verify
- `src/features/sessions/ui/LiveAgentsPreview.test.ts`
