---
name: sync-upstream
description: Merge a fork's upstream into its main through a reviewed sync PR, checking every fork feature its manifest lists.
disable-model-invocation: true
---

Merge `upstream/main` into the fork, check every fork feature the upstream change puts at risk, open a sync PR, and merge it once it is **safe**.

The fork's **manifest** drives the run: `docs/fork/README.md` and one `docs/fork/<feature>.md` entry per fork feature, each naming its **Upstream hooks** (the edits to files that also exist upstream) and how to **Verify** it. The README's `## Sync settings` section holds what differs between forks. If the repo has no manifest, write the README from [MANIFEST-TEMPLATE.md](MANIFEST-TEMPLATE.md) with the user, then stop: entries come from the fork's history, one feature at a time, before a first sync.

Read the README and the repo's `AGENTS.md` / `CLAUDE.md` first. Where the README's settings or extra checks disagree with this file, the README wins.

A sync lands as a merge commit, never a rebase or a squash: the merge keeps `upstream/main` as a parent, which moves the merge-base forward.

## 1. Preflight

`origin` must be the settings' **Fork** and `upstream` the settings' **Upstream**. If either remote is missing or points elsewhere, stop and give the user the `git remote` commands that fix it.

```sh
git fetch origin && git fetch upstream
git rev-list --count origin/main..upstream/main
gh pr list -R <fork> --state open --search 'head:chore/sync-upstream' --json number,headRefName,url
```

Pass `-R <fork>` to every `gh` command: in a fork, `gh` defaults to the upstream parent, and nothing of this sync goes upstream.

Stop with a one-line report when the count is 0 (nothing to sync) or a `chore/sync-upstream*` PR is already open (link it).

## 2. Merge in a worktree

```sh
MB=$(git merge-base origin/main upstream/main)   # the previous merge-base
git worktree add .worktrees/sync-upstream-<YYYY-MM-DD> -b chore/sync-upstream-<YYYY-MM-DD> origin/main
git -C .worktrees/sync-upstream-<YYYY-MM-DD> merge --no-ff upstream/main -m "chore: merge upstream/main into fork"
```

Work in that worktree from here on. Resolve each conflict per the entry that names the file (its **On conflict** section where it has one, otherwise: take upstream's side, then re-apply the fork's hook on top). Take upstream's side for the settings' **Release files**, which the fork never bumps itself. Note every conflicted file and how you resolved it: any conflict outside the release files makes the sync not safe.

## 3. Sync check

1. List the upstream files the sync changed: `git diff --name-only $MB upstream/main`.
2. Find the features at risk: entries whose **Upstream hooks** name one of those files (`grep -l <path> docs/fork/*.md`).
3. For each feature at risk:
   - every hook still exists **and is still reached**: for code, trace it to its call site (a symbol that still exists can have lost its caller); for prose, read the paragraph around the hook's phrase (a merge without conflict can leave upstream's sentence beside the fork's, or drop the fork's when upstream rewrote the paragraph);
   - its **Verify** checks pass;
   - upstream has not shipped the same behaviour; if it has, propose dropping the fork version rather than keeping both.
4. Renames: a file upstream moved or renamed takes its fork hooks along, and the entries' paths follow.
5. Coverage: every file of `git diff --name-only upstream/main...HEAD` that also exists in `upstream/main` appears in at least one entry, `docs/fork/` and the settings' **Ignored paths** aside. List the uncovered ones.
6. Run the README's **Extra checks**, if any.

Give each feature at risk a verdict: **intact**, **repaired** (say how), **superseded by upstream**, or **broken**. Repairing a hook means updating that feature's entry on the same branch.

Done when every feature at risk has a verdict and the coverage list is either empty or explained.

## 4. Checks

Run the settings' **Install**, then its **Checks**. For each failure, rerun the same check on `origin/main` (a throwaway worktree) and record whether it fails there identically; a pre-existing failure does not block.

## 5. Decide

The sync is **safe** only if all hold:

- no conflict outside the release files;
- every check passes, or fails identically on `origin/main`;
- every feature at risk is **intact**;
- the coverage list is empty.

Anything else (a conflict, a repaired, superseded or broken feature, an uncovered file, a new failure) makes it **needs review**, with the reason.

## 6. Open the PR

Commit any repair or manifest update on the branch, push it to `origin`, and open the PR with `gh pr create -R <fork> --base main --head chore/sync-upstream-<YYYY-MM-DD> --title 'chore: sync with upstream (<YYYY-MM-DD>)' --body-file <file>`. The body holds:

- `⚠️ Needs review: <reason>` as its first line when the sync is not safe;
- the upstream range (`$MB..upstream/main`, commit count);
- what the settings' **PR summary** asks for;
- check results, conflicts and their resolution, features at risk with verdicts, coverage report;
- the merge decision, then the attribution line the session gives for PRs.

## 7. Merge

Give the user the same report in a few lines with the PR link.

- **Safe**: ask for confirmation, then `gh pr merge <number> -R <fork> --merge --delete-branch`. Use `--merge` only: `--squash` and `--rebase` break the fork's ancestry with upstream.
- **Needs review**: leave the PR open and list what the user must look at.

Leave the worktree in place: it is cleaned up with its session.
