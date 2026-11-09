# Background command logs

A "Logs" pill next to the command, shown on hover, opens a command's output in the detail sheet above the composer and follows the file live while the command runs. It shows on background shell commands (Claude's task output file) and on any command that redirects its stdout to a file (`> /tmp/x.log`), whose file is then read instead.

## Fork files
- `src/features/sessions/model/commandLogs.ts` — task id, Claude's output file and the command's redirect target, read from the transcript blocks; `renderTerminalLog` drops ANSI escapes and `\r` redraws
- `src/features/sessions/ui/CommandLogSheet.tsx` — `CommandLogsButton`, `CommandLogBody`, polling through `read_log_tail`
- `src-tauri/src/log_tail.rs` — `read_log_tail`: last 512 KB of a file, skipped when its size has not changed
- `src/features/sessions/ui/SubagentDetailSheet.tsx` — `isCommandLogBlock` branch picks the body (fork file from subagent-detail-sheet)
- `src/features/sessions/ui/ExpandableCommandRow.tsx` — `<CommandLogsButton>` after the label, inside the row button (fork file from expandable-commands)

## Upstream hooks
- `src-tauri/src/lib.rs` — `mod log_tail`, `log_tail::read_log_tail` in the invoke handler

## Verify
- `src/features/sessions/model/commandLogs.test.ts`, `src/features/sessions/ui/CommandLogSheet.test.ts`, `log_tail::tests` in `src-tauri`
- Manual: ask Claude to run `for i in $(seq 30); do echo $i; sleep 1; done` in the background, hover its row, click "Logs"; the numbers appear as they are printed.
