# Expandable command rows

In an agent's activity trail, each shell command row opens on click onto the full command and its output. Failed commands keep upstream's error disclosure.

## Fork files
- `src/features/sessions/ui/ExpandableCommandRow.tsx` — `isExpandableCommand`, `ExpandableCommandRow`

## Upstream hooks
- `src/features/sessions/ui/AgentTranscript.tsx` — `isExpandableCommand` branch in `ActivityToolRow`, after `needsApproval`

## Verify
- `src/features/sessions/ui/ExpandableCommandRow.test.ts`
- Manual: expand a "Running N commands" group in a chat, click a command; the full command and its output appear below it.
