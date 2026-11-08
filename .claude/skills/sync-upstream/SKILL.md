---
name: sync-upstream
description: Merge hardbeat920/monocode into the fork's main through a reviewed sync PR.
disable-model-invocation: true
---

Merge `upstream/main` into the fork, run the fork's sync check, open a sync PR, and merge it once it is **safe**. The "Upstream sync check" section of [`docs/fork/README.md`](../../../docs/fork/README.md) is the checklist this skill runs and wins where this file disagrees. Read it and `AGENTS.md` first.

A sync lands as a merge commit, never a rebase or a squash: the merge keeps `upstream/main` as a parent, which moves the merge-base forward.

## 1. Preflight

```sh
git fetch origin && git fetch upstream
git rev-list --count origin/main..upstream/main
gh pr list --state open --search 'head:chore/sync-upstream' --json number,headRefName,url
```

Stop with a one-line report when the count is 0 (nothing to sync) or a `chore/sync-upstream*` PR is already open (link it).

## 2. Merge in a worktree

```sh
MB=$(git merge-base origin/main upstream/main)   # the "previous merge-base" of the checklist
git worktree add .worktrees/sync-upstream-<YYYY-MM-DD> -b chore/sync-upstream-<YYYY-MM-DD> origin/main
git -C .worktrees/sync-upstream-<YYYY-MM-DD> merge --no-ff upstream/main -m "chore: merge upstream/main into fork"
```

Work in that worktree from here on. Resolve each conflict per `AGENTS.md`: take upstream's code, then re-apply the fork's thin hook on top. Note every conflicted file and how you resolved it: any conflict makes the sync not safe.

## 3. Sync check

Run every step of the checklist in `docs/fork/README.md` with `$MB` as the previous merge-base and `HEAD` as the fork side. For each feature at risk, trace each hook to its call site (a symbol that still exists can have lost its caller), run its Verify tests, and give a verdict: **intact**, **repaired** (say how), **superseded by upstream**, or **broken**. Repairing a hook means updating that feature's entry on the same branch.

Coverage: every file of `git diff --name-only upstream/main...HEAD` that also exists in `upstream/main` appears in at least one `docs/fork/*.md` entry. List the uncovered ones.

Done when every feature at risk has a verdict and the coverage list is either empty or explained.

## 4. Checks

`npm ci`, then `npm run check`. For each failure, rerun the same test on `origin/main` (a throwaway worktree) and record whether it fails there identically; a pre-existing failure does not block.

## 5. Decide

The sync is **safe** only if all hold:

- no conflict;
- every check passes, or fails identically on `origin/main`;
- every feature at risk is **intact**;
- the coverage list is empty.

Anything else (a conflict, a repaired, superseded or broken feature, an uncovered file, a new failure) makes it **needs review**, with the reason.

## 6. Open the PR

Commit any repair or manifest update on the branch, push it, and open the PR with `gh pr create --base main --head chore/sync-upstream-<YYYY-MM-DD> --title 'chore: sync with upstream (<YYYY-MM-DD>)' --body-file <file>`. The body holds:

- `⚠️ Needs review: <reason>` as its first line when the sync is not safe;
- the upstream range (`$MB..upstream/main`, commit count);
- desktop-relevant changes (`src/`, `src-tauri/`, `crates/monocode-core/`) grouped by theme; mobile and native in one line;
- whether a production build is worth it, and why;
- check results, conflicts and their resolution, features at risk with verdicts, coverage report;
- the merge decision, then the Claude Code attribution line.

## 7. Merge

Give the user the same report in a few lines with the PR link.

- **Safe**: ask for confirmation, then `gh pr merge <number> --merge --delete-branch`. Use `--merge` only: `--squash` and `--rebase` break the fork's ancestry with upstream.
- **Needs review**: leave the PR open and list what the user must look at.

Leave the worktree in place: it is cleaned up with its session.
