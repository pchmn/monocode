# Claude native slash commands

The `/` picker of a Claude session lists the commands the Claude CLI reports (built-ins like `/context` or `/usage`, bundled skills like `/simplify`, user and plugin skills) and sends them to the CLI unchanged, so it runs them as in the terminal. Commands MonoCode runs itself (`clear`, `compact`, `mcp`) and terminal-only ones (`color`, `model`, …) stay hidden. Skills only MonoCode finds on disk (`.agents/skills`, `.cursor/skills`, …) are still listed and get their `SKILL.md` appended to the prompt. Before the first message of a session the CLI list is not known yet, so the picker shows the disk skills.

## Fork files
- `src/integrations/harness/providers/claude/claudeCommands.ts` — CLI list from the `initialize` control response, hidden commands, merge with disk skills, prompt injection for disk-only skills

## Upstream hooks
- `src/integrations/harness/providers/claude/claudeAdapter.ts` — `commands: claudeCommandProvider`: makes Claude a native-command harness
- `src/integrations/harness/providers/claude/claude.ts` — `noteClaudeCommands` in `handleLine`'s `control_response` branch; `withClaudeDiskSkills` around the `runTurn` call in `sendClaudeTurn`

## Verify
- `src/integrations/harness/providers/claude/claudeCommands.test.ts`
- Manual: in a Claude session, send one message, then type `/`: `/context`, `/usage` and `/simplify` are listed, `/clear` is MonoCode's. Send `/context`: the context usage table appears without a model call.
