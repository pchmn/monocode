# Subagent detail sheet

A "Details" button on each subagent row opens the run's whole trail (messages, thinking, every tool call with its output and diff, final report) in a resizable sheet above the composer. It follows the run live, closes on Esc, its close button, or a click outside the sheet and the composer dock, and remembers its height.

## Fork files
- `src/features/sessions/ui/SubagentDetailSheet.tsx` — the button and the sheet; they talk through a DOM event scoped to the session pane
- `src/features/sessions/model/subagentDetail.ts` — open event, height clamp and persistence

## Upstream hooks
- `src/features/sessions/ui/AgentTranscript.tsx` — `SubagentPanel`: `group/subagent grid` wrapper, `<SubagentDetailsButton>` after the row button, `col-span-2` on the `zen-phase-body`
- `src/features/sessions/ui/SessionPane.tsx` — `<SubagentDetailSheet>` first in the docked `data-session-composer`, before `<ApprovalSheet>`

## Verify
- `src/features/sessions/ui/SubagentDetailSheet.test.ts`
- Manual: run a prompt that spawns a subagent, hover its row, click "Details"; drag the sheet's top edge, then close it with Esc.
