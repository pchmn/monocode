# Code navigation through tsgo

In TS/JS files, `Mod`-click (or F12) jumps to the symbol's definition, in the same file or by opening another one; holding `Mod` underlines the word under the pointer. `Mod-F12` goes to the implementation, `Mod-Shift-F12` to the type definition. `Shift-F12` lists every reference grouped by file with a line preview. `Mod-Shift-O` searches the open file's symbols and `Mod-Alt-O` the repository's (from anywhere, through the last focused script editor; `⌘T` stays Tab: New). All are rebindable in Settings › Keybindings. Hovering a symbol for 300 ms shows its type or signature, highlighted, with its JSDoc. Everything comes from `tsgo --lsp`, one process per repository, found in the project's `node_modules` (TypeScript 7 or `@typescript/native-preview`) or as a global `tsgo`. It starts on the first lookup or hover and stops 2 minutes after the repository's last looked-up file closes, after 15 minutes without a lookup, or when a third repository needs one (at most 2 run).

## Fork files
- `src-tauri/src/lsp_definition.rs` — `lsp_definition`, `lsp_implementation`, `lsp_type_definition`, `lsp_references`, `lsp_document_symbols`, `lsp_workspace_symbols`, `lsp_hover` and `lsp_close_document` commands: tsgo resolution, process per repo root, LSP framing, document sync, stop policy (`should_stop`, `MAX_SERVERS`)
- `src/features/files/editor/editorGoToDefinition.ts` — click handling, underline, error tooltip, close notice for synced files; `openLocation` emits `OPEN_DEFINITION_EVENT` for other files
- `src/features/files/editor/editorLspNavigation.ts` — rebindable F12-family and symbol keys; remembers the last focused script editor; emits `LSP_NAVIGATION_EVENT`
- `src/features/files/ui/LspNavigationHost.tsx` — opens `SymbolPicker` / `ReferencesPanel` on that event, owns the workspace-symbol shortcut
- `src/features/files/model/lspSymbols.ts` — symbol kinds, fuzzy ranking, Tauri calls
- `src/features/files/editor/editorHover.ts` — hover tooltip, code highlighted with `highlightSource`
- `src/features/files/hooks/useOpenDefinitionEvents.ts` — relays `OPEN_DEFINITION_EVENT` to `onOpenFile`

## Upstream hooks
- `src-tauri/src/lib.rs` — `mod lsp_definition`; its `lsp_*` commands in `generate_handler!`
- `src/features/files/ui/FileEditor.tsx` — `editorGoToDefinition(path)`, `editorHover(path)` and `editorLspNavigation(path)` in the editor extensions
- `src/app/App.tsx` — `useOpenDefinitionEvents(onOpenFile)` after `onOpenFile`; `<LspNavigationHost />` after the `FilePicker`
- `src/features/projects/ui/ProjectSearch.tsx` — `groupMatches` and `MatchGroup` exported for `ReferencesPanel`

## Verify
- `src/features/files/editor/editorGoToDefinition.test.ts`, `editorHover.test.ts`, `src/features/files/model/lspSymbols.test.ts`, `cargo test lsp_definition`
- Manual: with `tsgo` available, `⌘`-click an imported function in a `.ts` file: its source file opens at the declaration. `⇧F12` on it lists its call sites; `⌘⇧O` lists the file's functions and classes.
