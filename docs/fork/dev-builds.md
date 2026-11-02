# Dev builds and fork install

Debug builds use their own app identifier (`com.monocode.desktop.dev`), so they never share data with the installed app. A script builds and installs the fork on macOS. (PRs #16, #20)

## Fork files
- `scripts/install-fork-macos.sh`

## Upstream hooks
- `src-tauri/src/lib.rs` — `DEV_IDENTIFIER`, `context.config_mut().identifier` override under `debug_assertions` in `run`
- `src-tauri/src/macos.rs` — `DEV_BUNDLE_ID` removed; `crate::DEV_IDENTIFIER` in `relaunch_from_dev_bundle` and `dev_bundle_plist`
- `CONTRIBUTING.md` — note on the dev identifier

## Verify
- Manual: `npm run tauri dev` while the installed app runs; each keeps its own sessions.
