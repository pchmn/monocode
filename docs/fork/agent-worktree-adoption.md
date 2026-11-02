# Agent worktree adoption

A session started on the project checkout follows the worktree its agent creates with `git worktree add` or Claude Code's `EnterWorktree` tool (until `ExitWorktree`): once the turn ends, the session's working copy, branch, Explorer and Changes switch to that worktree, and the next turn resumes the same conversation there. Claude and Codex only, the providers that resume from another cwd.

## Fork files
- `src/features/source-control/model/agentWorktree.ts` — parses `git worktree add` out of shell tool blocks and the path out of `EnterWorktree` results, picks the latest worktree that still exists
- `src/features/source-control/hooks/useAgentWorktreeAdoption.ts` — runs when a session goes idle; rebinds the provider session to the new cwd before setting `worktreeCwd`

## Upstream hooks
- `src/app/App.tsx` — `useAgentWorktreeAdoption(sessions, setSessions)`, after `useIdleSessionDetach`

## Verify
- `src/features/source-control/model/agentWorktree.test.ts`
- Manual: in a Claude session on "Current checkout", ask the agent to run `git worktree add .worktrees/try -b try/adopt`. When the turn ends, the footer shows "Worktree" and `try/adopt`, Changes lists that worktree, and a follow-up question about the earlier turn gets an answer that remembers it.
