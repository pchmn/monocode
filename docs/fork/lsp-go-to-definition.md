# Code navigation and assistance through tsgo

In TS/JS files, `Mod`-click (or F12) jumps to the symbol's definition, in the same file or by opening another one; holding `Mod` underlines the word under the pointer. `Mod-F12` goes to the implementation, `Mod-Shift-F12` to the type definition. `Shift-F12` lists every reference grouped by file with a line preview. `Mod-Shift-O` searches the open file's symbols and `Mod-Alt-O` the repository's (from anywhere, through the last focused script editor; `⌘T` stays Tab: New). All are rebindable in Settings › Keybindings. Hovering a symbol for 300 ms shows its type or signature, highlighted, with its JSDoc. TypeScript's errors and warnings are underlined (unused code faded) with their message on hover, and replace the syntax lint on files tsgo serves; the tab's error badge counts errors only. Completion comes from tsgo once it has answered for the file (members, module exports, parameters), with the selected item's type and doc beside the list; accepting a symbol from another module adds its import. Typing `(` or `,` in a call shows its signature above the caret, active parameter in bold; `⌃⇧Space` reopens it, `↑`/`↓` cycle overloads. `⌥↵` (or the lint tooltip's *Quick Fix…*) lists tsgo's fixes for the diagnostics under the caret or on its line; `⌥⇧O` organizes imports. `⌘.` stays App: Switch Model (a native menu accelerator). Everything comes from `tsgo --lsp`, one process per repository, found in the project's `node_modules` (TypeScript 7 or `@typescript/native-preview`) or as a global `tsgo`. It starts when a TS/JS file opens (its first diagnostics pull), then follows every edit of the repository's open TS/JS files (incremental `didChange`, batched 250 ms after typing pauses). It stops 2 minutes after the repository's last open file closes, after 15 minutes without a message, or when a third repository needs one (at most 2 run); the next lookup restarts it.

## Fork files
- `src-tauri/src/lsp_server.rs` — `lsp_document`, `lsp_connect` and `lsp_send` commands: tsgo resolution, process per repo root, `stdio` ↔ Tauri channel relay, answers server requests, drops info logs, stop policy (`should_stop`, `MAX_SERVERS`)
- `src/features/files/editor/lsp/languageServer.ts` — `editorLanguageServer`: one `@codemirror/lsp-client` client per repo root, reconnect after exit, debounced sync; `lspRequest` for every feature
- `src/features/files/editor/lsp/editorWorkspace.ts` — workspace allowing one file in several editors
- `src/features/files/editor/lsp/tauriTransport.ts` — client transport; sends in order, one `invoke` at a time
- `src/features/files/editor/lsp/fakeTsgo.ts` — test double for the Rust commands
- `src/features/files/editor/editorGoToDefinition.ts` — click handling, underline, error tooltip, `lspLocations`; `openLocation` emits `OPEN_DEFINITION_EVENT` for other files
- `src/features/files/editor/editorLspNavigation.ts` — rebindable F12-family and symbol keys; remembers the last focused script editor; emits `LSP_NAVIGATION_EVENT`
- `src/features/files/ui/LspNavigationHost.tsx` — opens `SymbolPicker` / `ReferencesPanel` on that event, owns the workspace-symbol shortcut
- `src/features/files/model/lspSymbols.ts` — symbol and reference requests, symbol flattening, reference previews, kinds, fuzzy ranking
- `src/features/files/editor/editorHover.ts` — hover tooltip, code highlighted with `highlightSource`; `renderHover` reused by completion docs and signature help
- `src/features/files/editor/editorLspAssist.ts` — bundles the four below and their rebindable keys (Quick Fix, Organize Imports, Trigger Parameter Hints)
- `src/features/files/editor/editorLspDiagnostics.ts` — `withLspDiagnostics` pulls `textDocument/diagnostic` in place of the syntax lint, falls back to it when tsgo is missing; re-lints the repository's other open files after an edit; `lintErrorCount`
- `src/features/files/editor/editorLspCompletion.ts` — completion source swapped in on `lspServed`; resolve for docs and auto-import edits
- `src/features/files/editor/editorSignatureHelp.ts` — signature tooltip
- `src/features/files/editor/editorQuickFix.ts` — code action menu at the caret, organize imports
- `src/features/files/editor/lsp/workspaceEdit.ts` — applies a `WorkspaceEdit` to open editors, or on disk
- `src/features/files/hooks/useOpenDefinitionEvents.ts` — relays `OPEN_DEFINITION_EVENT` to `onOpenFile`

## Upstream hooks
- `src-tauri/src/lib.rs` — `mod lsp_server`; its `lsp_*` commands in `generate_handler!`
- `src/features/files/ui/FileEditor.tsx` — `editorLanguageServer(path)`, `editorGoToDefinition(path)`, `editorHover(path)`, `editorLspNavigation(path)` and `editorLspAssist(path)` in the editor extensions
- `src/features/files/editor/editorLint.ts` — source wrapped in `withLspDiagnostics`; badge counts `lintErrorCount`
- `src/app/App.tsx` — `useOpenDefinitionEvents(onOpenFile)` after `onOpenFile`; `<LspNavigationHost />` after the `FilePicker`
- `src/features/projects/ui/ProjectSearch.tsx` — `groupMatches` and `MatchGroup` exported for `ReferencesPanel`
- `package.json` — `@codemirror/lsp-client`

## Verify
- `src/features/files/editor/lsp/languageServer.test.ts`, `editorLspAssist.test.ts`, `editorGoToDefinition.test.ts`, `editorHover.test.ts`, `src/features/files/model/lspSymbols.test.ts`, `cargo test lsp_server`
- Manual: with `tsgo` available, `⌘`-click an imported function in a `.ts` file: its source file opens at the declaration. `⇧F12` on it lists its call sites; `⌘⇧O` lists the file's functions and classes. Add a few lines above a call without saving, then hover it: its type still shows. Assign a string to a `number`: it is underlined and the tab shows 1 error. Type the start of a function exported by another file and accept it: its import appears. Type `(` after it: the signature shows. Delete the import, put the caret on the call and press `⌥↵`: *Add import* restores it.
