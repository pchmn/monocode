# Subagent detail sheet

A "Details" pill next to each subagent's name, shown on hover, opens the run's whole trail (messages, thinking, every tool call with its output and diff, final report) in a resizable sheet above the composer. It steps in one notch per card below it (queue, approval), so they read as a pile, and the working runner walks on its top edge. It follows the run live, closes on Esc, its close button, or a click outside the sheet and the composer dock, and remembers its height.

## Fork files
- `src/features/sessions/ui/SubagentDetailSheet.tsx` — the button and the sheet; they talk through a DOM event scoped to the session pane
- `src/features/sessions/model/subagentDetail.ts` — open event, height clamp and persistence
- `src/features/sessions/ui/DetailsPill.tsx` — the outlined trigger, a `span role="button"` since it sits inside the row's toggle button

## Upstream hooks
- `src/features/sessions/ui/AgentTranscript.tsx` — `SubagentPanel` label: `<SubagentDetailsButton>` after the name, which loses `flex-1`; `ml-auto` on the model/status span
- `src/features/sessions/ui/SessionPane.tsx` — `<SubagentDetailSheet>` first in the docked `data-session-composer`, before `<ApprovalSheet>`

## Verify
- `src/features/sessions/ui/SubagentDetailSheet.test.ts`
- Manual: run a prompt that spawns a subagent, hover its row, click "Details"; drag the sheet's top edge, then close it with Esc.
