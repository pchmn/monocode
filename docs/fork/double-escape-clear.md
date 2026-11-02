# Double Escape clears the draft

Pressing Escape twice quickly in the composer clears the draft. (PR #9)

## Fork files
- `src/features/sessions/ui/doubleEscapeClear.ts` — `clearOnDoubleEscape`

## Upstream hooks
- `src/features/sessions/ui/Composer.tsx` — `lastEscapeRef`, `clearOnDoubleEscape` in the key-down handler

## Verify
- `src/features/sessions/ui/doubleEscapeClear.test.ts`
