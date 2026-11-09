# Steer delivery

A message sent to a running Claude turn shows "Waiting" under it until Claude actually reads it, which happens only when its current step ends. If the turn ends first (Stop, crash, provider switch), the message goes back to the queue instead of being lost. The same happens when the turn ends just before the steer reaches Claude ("No active turn to steer").

## Fork files
- `src/integrations/harness/providers/claude/claudeSteerDelivery.ts` — tags steers with a uuid and maps Claude's `command_lifecycle` lines to `steer.*` events
- `src/features/sessions/model/steerDelivery.ts` — pending flag on the user block; unread or refused steers back to the queue
- `src/features/sessions/ui/SteerPendingNote.tsx`

## Upstream hooks
- `src/integrations/harness/providers/claude/claude.ts` — `steerClaudeTurn`: `tagSteerMessage`; `handleLine`: `steerLifecycleEvent`; `maybeFinishTurn`: `hasWaitingSteers`
- `src/integrations/harness/core/types.ts` — `steer.queued` / `steer.delivered` events, `SteerTurnInput.id`
- `src/integrations/harness/core/apply.ts` — `UserTurnExtra.id`; `applyHarnessEvent`: `applySteerDelivery`; `stopStreaming`: `returnUnreadSteers`
- `src/features/sessions/model/session.ts` — `Block.steerPending`
- `src/features/sessions/ui/AgentTranscript.tsx` — `SteerPendingNote` under the user bubble
- `src/app/App.tsx` — `steerId`: shared by the steered user block and `steerHarnessTurn`; its `catch`: `returnRefusedSteer` on `TurnNotReadyError`

## Verify
- `src/integrations/harness/providers/claude/claudeSteerDelivery.test.ts`
- `src/features/sessions/model/steerDelivery.test.ts`
- Manual: ask Claude to run `sleep 30`, send a message while it runs (it shows "Waiting"), press Stop: the message is back in the queue.
