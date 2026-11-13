# VS Code editor keys

The file editor follows VS Code's editing shortcuts: multi-cursor (Alt-click, `Mod-d`, `Shift-Mod-l`), column selection (Shift-Alt-drag), line comment, move/copy/delete/insert line, go to bracket or line, expand selection. Each one is listed in Settings › Keybindings and can be rebound or disabled. App shortcuts keep `Mod-[`/`Mod-]`, `Mod-Alt-Up/Down` and `Mod-k`.

## Fork files
- `src/features/settings/model/editorKeybindings.ts` — rows shown in Settings, free of CodeMirror imports to avoid a cycle with `settings.ts`
- `src/features/files/editor/editorVscodeKeys.ts` — default chords, rebound chords, multi-cursor setup

## Upstream hooks
- `src/features/files/ui/FileEditor.tsx` — `editorVscodeKeys`: added to the editor extensions
- `src/features/settings/model/settings.ts` — `EDITOR_KEYBINDINGS`: spread into `KEYBINDINGS`; `"/": "Slash"` in `KEY_CODES` so `Mod-/` counts in conflict checks

## Verify
- `src/features/files/editor/editorVscodeKeys.test.ts`
- Manual: in a file, select a word and press `⌘D`: the next occurrence is added and the pane does not split. Rebind "Editor: Toggle Line Comment" in Settings: the new chord comments, `⌘/` no longer does.
