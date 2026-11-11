# Fork manifest

This repo is a fork of [<upstream>](https://github.com/<upstream>) (the `upstream` remote). One file per fork feature: what it does, where it plugs into upstream files, and how to check it still works. `git log upstream/main..main` holds the history; this folder holds the intent and the coupling, which the history does not show.

## Entry format

```md
# <Feature name>

<User-visible behaviour, 1 to 3 lines.> (PRs #N, #M)

## Fork files
- `path/to/new-file`: role, when not obvious from the name

## Upstream hooks
- `path/to/upstream-file`: `symbolOrPhraseToSearch`: what the hook does

## On conflict
- <optional: which side wins, and what of upstream's change to carry over>

## Verify
- <a test, a grep, or one concrete manual check>
```

Name each hook by a symbol or a phrase to search for, never by line number: line numbers drift on every upstream merge. A hook is any edit to a file that also exists upstream, including a signature change another fork file relies on.

## Keeping it current

A PR that adds, changes or removes fork behaviour updates its entry in the same PR (new feature: new file; feature dropped: delete the file).

## Sync settings

Read by `/sync-upstream`, which merges upstream through a reviewed PR and runs the sync check.

- **Upstream**: `<owner>/<repo>`
- **Fork**: `<owner>/<repo>`
- **Install**: `<command>`
- **Checks**: `<command>`, `<command>`
- **Release files**: <files whose version the fork never bumps, e.g. `CHANGELOG.md`; or "none">
- **Ignored paths**: <paths the coverage check skips, or "none">
- **PR summary**: <what the sync PR body groups upstream's changes by, and what it calls out>
- **Extra checks**: <optional repo-specific checks after the sync check>
