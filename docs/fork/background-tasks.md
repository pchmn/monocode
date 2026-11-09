# Background tasks and subagents

An agent whose turn has yielded but still has background tasks shows as "resting" (sidebar card, Working panel card, title-bar tab, transcript fold) instead of working. Messages queued before the turn yielded are steered to the agent then, like new ones, instead of waiting behind the background work, and `/compact` runs inside the resting turn. Backgrounded Claude subagents get their step trail mirrored from their on-disk transcript. (PRs #21, #25)

## Fork files
- `src/features/sessions/model/backgroundTasks.ts` — `isBackgroundOnly`, `usePublishBackgroundTasks`, `useSessionBackgroundTasks`
- `src/features/sessions/ui/BackgroundTasks.tsx` — `BackgroundStatus`, `BackgroundBadge`, `BackgroundDot`, `backgroundActivity`, `BackgroundTasksFold`
- `src/integrations/harness/providers/claude/claudeSubagentLog.ts` — polls the `claude_subagent_log` command
- `src-tauri/src/claude_subagent_log.rs` — reads the subagent transcript lines
- `src/integrations/harness/providers/claude/claudeCompact.ts` — `isRestingOnBackground`, `compactWhileResting`

## Upstream hooks
- `src/app/App.tsx` — `usePublishBackgroundTasks(sessions)`; `backgroundHarnesses` in `toTitleTab` (`isBackgroundOnly`) and in `titleTabsEqual`; `isBackgroundOnly` next to `monoForSession` in the queue dispatcher's steer condition; `resting` in `onCompactContext` (keeps `busy` and the turn generation)
- `src/app/shell/TitleBar.tsx` — `backgroundHarnesses` on `Tab` and in `TabHarnesses` (`"background"` status, `BackgroundBadge`)
- `src/app/shell/Sidebar.tsx` — `useSessionBackgroundTasks` and `BackgroundStatus` in `SessionCard`
- `src/features/sessions/ui/AgentTranscript.tsx` — `BackgroundTasksFold`; `LiveFoldTitle` pauses the timer while `background` is set
- `src/features/sessions/ui/LiveAgentsPreview.tsx` — `useSessionBackgroundTasks`, `BackgroundDot` and `backgroundActivity` (`[bg] <task>`) in `LiveAgentCard`
- `src/features/workspace/ui/StackedTabs.tsx` — `BackgroundBadge` on the session sub-tab (fork file from session-sub-tabs)
- `src/integrations/harness/providers/claude/claude.ts` — `compactWhileResting` branch in `compactClaudeContext`, `compactionSettled` on `Live` (settled in `handleResult`, `finishActiveTurn`, exit, `stopClaudeSession`); `followBackgroundAgent` in `handleAgentLifecycle`; `stopClaudeSubagentLog(s)` in `stopClaudeSession`, `runTurn`, `completeAgentTask`
- `src/integrations/harness/core/registry.ts` — `compactHarnessContext` takes the steer queue during an active turn (the turn holds the session queue until its background work ends)
- `src-tauri/src/lib.rs` — `mod claude_subagent_log`, `claude_subagent_log` in the invoke handler

## Verify
- `src/features/sessions/ui/LiveAgentsPreview.test.ts` — "shows an agent resting on background tasks with its task"
- `src/integrations/harness/core/registry.test.ts` — "compacts a session whose turn rests on background work"
- `src/integrations/harness/providers/claude/claudeLive.test.ts` — "mirrors a backgrounded subagent's trail from its transcript file", "compacts inside a turn resting on a background command"
- Manual: have Claude start a background subagent; its steps appear in the transcript and the tab shows the resting badge once the turn ends. A message queued during the turn is sent as soon as it yields. With a dev server left running, `/compact` compacts and the tab stays resting.
