# Steer delivery

A message sent to a running Claude turn shows "Waiting" under it until Claude actually reads it, which happens only when its current step ends. If the turn ends first (Stop, crash, provider switch), the message goes back to the queue instead of being lost. The same happens when the turn ends just before the steer reaches Claude ("No active turn to steer").

After 15 s the note shows how long the message has waited and an "Interrupt and send" button. It sends Claude a plain `interrupt`, which cuts the running step short without ending the turn or its background tasks (unlike Stop), so Claude reads the message right away.

Until it is read, the message sits at the end of the running turn, so the turn's "working for" line stays above it.

## Fork files
- `src/integrations/harness/providers/claude/claudeSteerDelivery.ts` — tags steers with a uuid and maps Claude's `command_lifecycle` lines to `steer.*` events
- `src/features/sessions/model/steerDelivery.ts` — pending flag on the user block; unread or refused steers back to the queue
- `src/features/sessions/ui/SteerPendingNote.tsx` — wait time and "Interrupt and send"
- `src/features/sessions/model/steerWait.ts` — long-wait threshold and its label

## Upstream hooks
- `src/integrations/harness/providers/claude/claude.ts` — `steerClaudeTurn`: `tagSteerMessage`; `handleLine`: `steerLifecycleEvent`; `maybeFinishTurn`: `hasWaitingSteers`; `interruptClaudeStep` (exported next to `cancelClaudeTurn`)
- `src/integrations/harness/core/types.ts` — `steer.queued` / `steer.delivered` events, `SteerTurnInput.id`
- `src/integrations/harness/core/apply.ts` — `UserTurnExtra.id`; `applyHarnessEvent`: `applySteerDelivery`; `stopStreaming`: `returnUnreadSteers`
- `src/features/sessions/model/session.ts` — `Block.steerPending`
- `src/features/sessions/model/transcriptActivity.ts` — `groupTranscriptTurns`: a `steerPending` user block stays in the running turn (under its work, below the live status line)
- `src/features/sessions/ui/AgentTranscript.tsx` — `SteerPendingNote` (with `block.sentAt`) under the user bubble
- `src/app/App.tsx` — `steerId`: shared by the steered user block and `steerHarnessTurn`; its `catch`: `returnRefusedSteer` on `TurnNotReadyError`

## Verify
- `src/integrations/harness/providers/claude/claudeSteerDelivery.test.ts`
- `src/features/sessions/model/steerDelivery.test.ts`
- `src/features/sessions/model/steerWait.test.ts`
- Manual: ask Claude to run `sleep 30`, send a message while it runs (it shows "Waiting"), press Stop: the message is back in the queue.
- Manual: ask Claude to start a background task, then run `sleep 120` in the foreground. Send a message: after 15 s, "Interrupt and send" appears. Click it: `sleep` is cut short, Claude answers the message, and the background task is still running.
