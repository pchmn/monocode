# Agent worktree adoption

A session started on the project checkout follows the worktree its agent creates with `git worktree add` or Claude Code's `EnterWorktree` tool (until `ExitWorktree`), or a wrapper such as `pnpm worktree <branch>`: as soon as the worktree exists, mid-turn, the session's working copy, branch, Explorer and Changes switch to it; the running provider process keeps its cwd until the turn ends, and the next turn resumes the same conversation in the worktree. Claude and Codex only, the providers that resume from another cwd. In a VS Code workspace, a session on a folder ("Current checkout") follows a worktree of that folder's repo the same way.

## Fork files
- `src/features/source-control/model/agentWorktree.ts` — parses `git worktree add` out of shell tool blocks and the path out of `EnterWorktree` results, picks the latest worktree that still exists; `worktreeToolCount` triggers the mid-turn rescans; `pickNewAgentWorktree` catches wrappers: a worktree absent when the turn started, mentioned by one of its tool blocks (command, output, edited file) and not used by another session
- `src/features/source-control/hooks/useAgentWorktreeAdoption.ts` — lists the worktrees when a turn starts, rescans whenever a finished tool call mentions a worktree (and once idle), sets `worktreeCwd` and registers the move
- `src/integrations/harness/core/sessionMoves.ts` — `moveHarnessSession` records it; `settleHarnessSessionMove` stops the old process and rebinds the provider session to the new cwd in the session's operation queue, so a queued message cannot start a fresh conversation

## Upstream hooks
- `src/app/App.tsx` — `useAgentWorktreeAdoption(sessions, setSessions)`, after `useIdleSessionDetach`
- `src/integrations/harness/core/registry.ts` — `settleHarnessSessionMove` before the adapter call in `sendHarnessTurn`, `compactHarnessContext`, `rewindHarnessLastTurn`
- `src/features/sessions/model/checkpoint.ts` — `finishSessionTurn` without `turnId` finishes in the cwd the turn began in (Stop after a mid-turn move)

## Verify
- `src/features/source-control/model/agentWorktree.test.ts`, `src/features/projects/model/workspaceFolderWorktrees.test.ts`, `src/integrations/harness/core/sessionMoves.test.ts`, `src/features/sessions/model/checkpoint.test.ts`
- Manual: in a Claude session on "Current checkout", ask the agent to run `git worktree add .worktrees/try -b try/adopt`, then `sleep 20`. Right after the `git worktree add` call finishes (before the turn ends), the footer shows "Worktree" and `try/adopt`, Changes lists that worktree, and a follow-up question about the earlier turn gets an answer that remembers it.
- Manual (wrapper): in a repo whose script wraps `git worktree add` (steevy's `pnpm worktree <branch>`), ask the agent to run it and then `cd` into the new worktree; the session moves there as soon as a finished tool call points at it.
- Manual (workspace): in a `.code-workspace`, a Claude session on a folder runs `git worktree add -b try/ws ../ws-try`; once it finishes the session moves to `ws-try` and stays listed under its folder.
