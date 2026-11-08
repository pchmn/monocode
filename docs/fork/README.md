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

## Upstream sync check

Sync with `git merge upstream/main`, and land a sync PR with a merge commit, never a squash: a squash drops `upstream/main` as a parent, so the merge-base stays put and the next sync replays every upstream change since. Feature PRs can still be squashed.

Run after the merge, before pushing (the `/sync-upstream` skill runs the whole sync end to end):

1. List the upstream files the sync changed: `git diff --name-only <previous merge-base> upstream/main`.
2. Find the features at risk: entries whose **Upstream hooks** name one of those files (`grep -l <path> docs/fork/*.md`).
3. For each feature at risk:
   - every hook still exists **and is still reached** (a call site upstream rewrote can keep the import and drop the call);
   - its **Verify** tests pass;
   - upstream has not shipped the same behaviour; if it has, propose dropping the fork version rather than keeping both.
4. Coverage: every upstream file in `git diff --name-only upstream/main...main` appears in at least one entry. Report any that do not.
5. `npm run check` passes.

Done when every feature at risk has a verdict: **intact**, **repaired** (say how), **superseded by upstream**, or **broken** (needs a human), and the coverage report lists no unexplained file.
