# Agent worktree adoption

A session started on the project checkout follows the worktree its agent creates with `git worktree add` or Claude Code's `EnterWorktree` tool (until `ExitWorktree`), or a wrapper such as `pnpm worktree <branch>`: once the turn ends, the session's working copy, branch, Explorer and Changes switch to that worktree, and the next turn resumes the same conversation there. Claude and Codex only, the providers that resume from another cwd. In a VS Code workspace, a session on a folder ("Current checkout") follows a worktree of that folder's repo the same way.

## Fork files
- `src/features/source-control/model/agentWorktree.ts` — parses `git worktree add` out of shell tool blocks and the path out of `EnterWorktree` results, picks the latest worktree that still exists; `pickNewAgentWorktree` catches wrappers: a worktree absent when the turn started, mentioned by one of its tool blocks (command, output, edited file) and not used by another session
- `src/features/source-control/hooks/useAgentWorktreeAdoption.ts` — runs when a session goes idle; lists the worktrees when a turn starts, rebinds the provider session to the new cwd before setting `worktreeCwd`

## Upstream hooks
- `src/app/App.tsx` — `useAgentWorktreeAdoption(sessions, setSessions)`, after `useIdleSessionDetach`

## Verify
- `src/features/source-control/model/agentWorktree.test.ts`, `src/features/projects/model/workspaceFolderWorktrees.test.ts`
- Manual: in a Claude session on "Current checkout", ask the agent to run `git worktree add .worktrees/try -b try/adopt`. When the turn ends, the footer shows "Worktree" and `try/adopt`, Changes lists that worktree, and a follow-up question about the earlier turn gets an answer that remembers it.
- Manual (wrapper): in a repo whose script wraps `git worktree add` (steevy's `pnpm worktree <branch>`), ask the agent to run it and then `cd` into the new worktree; the session moves there when the turn ends.
- Manual (workspace): in a `.code-workspace`, a Claude session on a folder runs `git worktree add -b try/ws ../ws-try`; when the turn ends the session moves to `ws-try` and stays listed under its folder.
