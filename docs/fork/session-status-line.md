# Session status line

Under the composer: tokens, context %, lifetime Claude cost and the branch's PR. The cost is persisted and survives restarts. (PR #8)

## Fork files
- `src/features/sessions/ui/SessionStatusLine.tsx` — `SessionStatusLine`, `SessionContextText`
- `src/features/sessions/model/sessionStatusLine.ts`

## Upstream hooks
- `src/integrations/harness/core/types.ts` — `{ type: "cost"; usd }` in `HarnessEvent`
- `src/integrations/harness/core/apply.ts` — `case "cost"` in `applyHarnessEvent`
- `src/integrations/harness/providers/claude/claudeProtocol.ts` — `costFromResult`
- `src/integrations/harness/providers/claude/claude.ts` — `costSeen` on `Live`, cost event emitted in `handleResult`
- `src/features/sessions/model/session.ts` — `costUsd` on `Session`
- `src/features/sessions/data/sessionStore.ts` — `costUsd` in `SessionRecord`, `SessionUpsertPayload`, `persistableMeta`, `recordToSession`
- `src-tauri/src/session_store.rs` — `cost_usd` column: structs, `migrate`, `upsert_session`, `get_session_record` (column index)
- `src/features/sessions/ui/SessionPane.tsx` — `statusInfo` passed to `Composer`
- `src/features/sessions/ui/Composer.tsx` — `statusInfo` prop, `SessionContextText` and `SessionStatusLine` in the footer

## Verify
- `src/features/sessions/model/sessionStatusLine.test.ts`
- `cargo test` (session store)
- Manual: run a Claude turn; the cost appears under the composer and is unchanged after an app restart.
