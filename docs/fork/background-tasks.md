# Background tasks and subagents

An agent whose turn has yielded but still has background tasks shows as "resting" (sidebar card, title-bar tab, transcript fold) instead of working. Backgrounded Claude subagents get their step trail mirrored from their on-disk transcript. (PRs #21, #25)

## Fork files
- `src/features/sessions/model/backgroundTasks.ts` — `isBackgroundOnly`, `usePublishBackgroundTasks`, `useSessionBackgroundTasks`
- `src/features/sessions/ui/BackgroundTasks.tsx` — `BackgroundStatus`, `BackgroundBadge`, `BackgroundTasksFold`
- `src/integrations/harness/providers/claude/claudeSubagentLog.ts` — polls the `claude_subagent_log` command
- `src-tauri/src/claude_subagent_log.rs` — reads the subagent transcript lines

## Upstream hooks
- `src/app/App.tsx` — `usePublishBackgroundTasks(sessions)`; `backgroundHarnesses` in `toTitleTab` (`isBackgroundOnly`) and in `titleTabsEqual`
- `src/app/shell/TitleBar.tsx` — `backgroundHarnesses` on `Tab` and in `TabHarnesses` (`"background"` status, `BackgroundBadge`)
- `src/app/shell/Sidebar.tsx` — `useSessionBackgroundTasks` and `BackgroundStatus` in `SessionCard`
- `src/features/sessions/ui/AgentTranscript.tsx` — `BackgroundTasksFold`; `LiveFoldTitle` pauses the timer while `background` is set
- `src/features/workspace/ui/StackedTabs.tsx` — `BackgroundBadge` on the session sub-tab (fork file from session-sub-tabs)
- `src/integrations/harness/providers/claude/claude.ts` — `followBackgroundAgent` in `handleAgentLifecycle`; `stopClaudeSubagentLog(s)` in `stopClaudeSession`, `runTurn`, `completeAgentTask`
- `src-tauri/src/lib.rs` — `mod claude_subagent_log`, `claude_subagent_log` in the invoke handler

## Verify
- `src/integrations/harness/providers/claude/claudeLive.test.ts` — "mirrors a backgrounded subagent's trail from its transcript file"
- Manual: have Claude start a background subagent; its steps appear in the transcript and the tab shows the resting badge once the turn ends.
