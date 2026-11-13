# Go to definition

In TS/JS files, `Mod`-click (or F12) jumps to the symbol's definition, in the same file or by opening another one; holding `Mod` underlines the word under the pointer. Definitions come from `tsgo --lsp`, one process per repository, found in the project's `node_modules` (TypeScript 7 or `@typescript/native-preview`) or as a global `tsgo`. It starts on the first lookup and stops 2 minutes after the repository's last looked-up file closes, after 15 minutes without a lookup, or when a third repository needs one (at most 2 run).

## Fork files
- `src-tauri/src/lsp_definition.rs` — `lsp_definition` and `lsp_close_document` commands: tsgo resolution, process per repo root, LSP framing, document sync, stop policy (`should_stop`, `MAX_SERVERS`)
- `src/features/files/editor/editorGoToDefinition.ts` — click/F12 handling, underline, error tooltip, close notice for synced files; emits `OPEN_DEFINITION_EVENT` for other files
- `src/features/files/hooks/useOpenDefinitionEvents.ts` — relays that event to `onOpenFile`

## Upstream hooks
- `src-tauri/src/lib.rs` — `mod lsp_definition`; `lsp_definition::lsp_definition` and `lsp_definition::lsp_close_document` in `generate_handler!`
- `src/features/files/ui/FileEditor.tsx` — `editorGoToDefinition(path)` in the editor extensions
- `src/app/App.tsx` — `useOpenDefinitionEvents(onOpenFile)` after `onOpenFile`

## Verify
- `src/features/files/editor/editorGoToDefinition.test.ts`, `cargo test lsp_definition`
- Manual: with `tsgo` available, `⌘`-click an imported function in a `.ts` file: its source file opens at the declaration.
