# Fork manifest

One file per fork feature: what it does, where it plugs into upstream code, and how to check it still works. `git log upstream/main..main` holds the history; this folder holds the intent and the coupling, which the history does not show.

## Entry format

```md
# <Feature name>

<User-visible behaviour, 1–3 lines.> (PRs #N, #M)

## Fork files
- `path/to/newFile.ts` — role, when not obvious from the name

## Upstream hooks
- `path/to/upstreamFile.tsx` — `symbolToSearch`: what the hook does

## Verify
- `path/to/feature.test.ts`
- Manual: <one concrete check in the running app>
```

Name each hook by a symbol to search for, never by line number: line numbers drift on every upstream merge. A hook is any edit to a file that also exists upstream, including a signature change (`export`, a new parameter) another fork file relies on.

## Keeping it current

A PR that adds, changes or removes fork behaviour updates its entry in the same PR (new feature: new file; feature dropped: delete the file). Small upstream bug fixes with no feature of their own go in [`small-fixes.md`](small-fixes.md).

## Sync settings

Read by `/sync-upstream` (from [pchmn/skills](https://github.com/pchmn/skills/tree/main/skills/misc/sync-upstream), installed globally), which merges upstream through a reviewed PR and runs the sync check.

- **Upstream**: `hardbeat920/monocode`
- **Fork**: `pchmn/monocode`
- **Install**: `npm ci`
- **Checks**: `npm run check`
- **Release files**: `CHANGELOG.md`, the `version` in `package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`
- **Ignored paths**: none
- **PR summary**: desktop-relevant changes (`src/`, `src-tauri/`, `crates/monocode-core/`) grouped by theme; mobile and native in one line; whether a production build is worth it, and why.
