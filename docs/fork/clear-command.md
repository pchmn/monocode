# /clear command

`/clear` in the composer replaces the session in its tab with a fresh session on the same project, worktree and branch. (PR #4) In a VS Code workspace it keeps the session's folder without opening the folder picker again.

## Fork files
- `src/features/sessions/model/clear.ts` — `CLEAR_COMMAND`, `isClearCommand`, `clearedSession`

## Upstream hooks
- `src/app/App.tsx` — `onClearSession` callback (`clearedSession`, `replaceLeafId`) passed down the workspace props
- `src/features/workspace/ui/PaneTree.tsx` — `onClearSession` in `Shared`, forwarded to `SessionPane`
- `src/features/sessions/ui/SessionPane.tsx` — `onClearSession` prop, forwarded to `Composer`
- `src/features/sessions/ui/Composer.tsx` — `CLEAR_COMMAND` in the slash-command list, `isClearCommand` checks on submit and Enter
- `src/integrations/harness/core/nativeCommands.ts` — `"clear"` in `RESERVED_COMMANDS`

## Verify
- `src/features/sessions/model/clear.test.ts`
- Manual: type `/clear` and send; the tab switches to an empty session, the old one stays in history.
- Manual (workspace): in a `.code-workspace` session on a chosen folder, `/clear` opens the fresh session on that folder with no picker.
