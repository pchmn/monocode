# Project settings: on-save commands

A repo can ship `.monocode/settings.json` (JSONC) to run a command when a file is saved with Cmd+S, e.g. a formatter:

```jsonc
{
  "onSave": [
    { "files": "**/*.rs", "command": "rustfmt ${file}" },
    { "files": ["src/**/*.{ts,tsx}", "*.json"], "command": "npx prettier --write ${file}" }
  ]
}
```

- The nearest `.monocode/settings.json` above the file wins; the lookup stops at the git root, so each worktree reads its own copy.
- `files` globs are relative to the folder holding `.monocode/` (`*`, `?`, `**`, `{a,b}`); a glob without `/` matches the file name at any depth. The first matching rule runs.
- `${file}` (absolute) and `${relativeFile}` expand to shell-quoted paths. The command runs from the project root through `/bin/sh -c` (`cmd /C` on Windows) with the login-shell PATH, and times out after 30 s.
- The file is written first, then the command runs and the editor reloads it. A failure shows as *Saved · on-save command failed* in the editor footer; clicking it shows the command's output. The file stays saved.
- A matching rule replaces the built-in Prettier format-on-save for that file, autosave included. Autosave never runs the command.
- MonoCode asks before running commands from a settings file, and again whenever its content changes (trust is keyed by path and SHA-256 in `localStorage`). Declining lasts until restart.
- Local files only: remote (`remote://`) files are skipped.

## Fork files
- `src-tauri/src/project_settings.rs` — settings lookup, glob matching, command runner
- `src/features/files/model/projectSaveCommand.ts` — trust prompt and run-then-reload
- `src/features/files/ui/SaveCommandFailure.tsx` — footer status and output popover

## Upstream hooks
- `src-tauri/src/lib.rs` — `mod project_settings`, `project_settings::project_save_command`, `project_settings::project_run_save_command`
- `src/features/files/ui/FileEditor.tsx` — `hasProjectSaveCommand` skips built-in Prettier; `runProjectSaveCommand` in the wrapper's `save`, its error stored as the `commandFailed` save state and rendered by `SaveCommandFailure`; `onSave` gains an `automatic` argument

## Verify
- `src/features/files/model/projectSaveCommand.test.ts`
- `cargo test --lib project_settings`
- Manual: add `{ "onSave": [{ "files": "*.md", "command": "printf '\\nsaved\\n' >> ${file}" }] }` to a repo, edit a Markdown file, press Cmd+S, allow the prompt: `saved` appears at the end of the file in the editor.
