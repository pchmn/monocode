# Code and explorer fonts

Settings → Editor sets the font family, size and line height of the file editor and the diff view, and the font size and row height of the file explorer and the Changes list. Defaults match VS Code on macOS (Google Sans Code 12/18px, explorer 13/22px).

## Fork files

- `src/features/settings/model/codeFonts.ts` — stored values, applied as CSS variables on `:root`
- `src/features/settings/ui/CodeFontSettings.tsx`
- `src/styles/codeFonts.css` — maps the variables onto CodeMirror and the diff rows

## Upstream hooks

- `src/main.tsx` — `applyCodeFonts()` at boot, `codeFonts.css` import
- `src/features/settings/ui/SettingsView.tsx` — `<CodeFontSettings Row={Row} />` in the Editor group
- `src/features/files/editor/editorChrome.ts` — `lineHeight: "var(--code-line-height)"` in `editorThemeStyles`
- `src/features/files/editor/editorGit.ts` — `codeLineHeightPx()` in `estimatedHeight`, `var(--code-line-height)` on deleted lines
- `src/features/source-control/model/unifiedDiffDocument.ts` — `codeLineHeightPx()` for line rows in `buildBody`
- `src/features/source-control/ui/UnifiedDiffView.tsx` — `useCodeFonts()`; the `ReviewDocumentBuilder` is rebuilt when the line height changes
- `src/features/source-control/ui/GitChangesPanel.tsx` — `--explorer-row-height` / `--explorer-font-size` classes in `ChangeRow` and `ChangeDirRow`
- `src/features/files/ui/FileTree.tsx` — `--explorer-row-height` / `--explorer-font-size` classes on tree rows, the rename row and the workspace root header

## Verify

- `src/features/settings/model/codeFonts.test.ts`
- Manual: change each setting with a file and a diff open; text and rows update, and the diff still scrolls to the right line.
