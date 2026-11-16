# Session linked to its branch's PR

When the PR of a session's branch is found (the `PR #n` under the composer), the session's GitHub link switches to that PR, replacing its issue or filling an empty link: the sidebar badge, update dot and activity card then follow the PR. Each session and PR pair is linked once, so relinking the issue by hand sticks. The lookup only links once the first message is sent and the session's own worktree exists: a draft in a VS Code workspace still sits on the first folder, whose branch PR belongs to another repo.

In the session hover card, the linked issue or PR is a block under the details: its state icon (state in its tooltip), the repo, which truncates first, and `#n` pinned right, then its title on two lines and, for a PR, a CI pill and a review pill that name what they measure ("CI failed", "Review awaiting"), then the author when it isn't one of the `gh` accounts, and the last update. A linked issue shows up to two of its labels instead of the pills. A linked issue's icon follows GitHub's: green dot when open, violet check once completed, grey slashed circle when closed as not planned. Clicking the block opens it on GitHub. The hover popover of a `PR #n` chip in the transcript shows the same CI and review pills.

A session lists every PR it met, in any repo: its branch PR and each PR the agent opened, read from a `gh pr create` (or GitHub MCP `create_pull_request`) call whose output holds the new PR's URL. A PR the agent only views or cites is never listed. With several, the hover card folds each into one line (state icon with its CI chip, repo, title, `#n`, and a button that opens it on GitHub); clicking a line unfolds today's block content. The sidebar badge adds `+n` for the other PRs, and its chip shows the worst CI among the open ones, or a red `!` when any of them conflicts.

A linked PR's sidebar badge, title-tab icon and hover-card block show its state: green when open, grey draft icon while a draft, violet merge icon once merged, red once closed. While open or draft, a small tinted chip cut into the icon's bottom-right corner gives its CI rollup (amber pulsing dot while checks run, soft red cross once one fails, green check once they pass). A PR in conflict with its base takes that chip with a red `!` instead, and the hover card and transcript chip popover add a "Merge conflicts" pill before the CI one. The icon stands alone: the sidebar badge drops the PR number; its tooltip reads e.g. "Open · Merge conflicts · CI running". Each visible PR is fetched every 3 minutes until merged, every 45 s while its CI runs, and again when the window regains focus if its state is over 15 s old; while GitHub recomputes mergeability (`unknown`, right after a push), the last conflict answer stays; merged PRs are remembered across launches and never fetched again.

## Fork files
- `src/features/sessions/model/branchPrAutoLink.ts` — PR report channel, once-per-pair guard (localStorage)
- `src/features/sessions/hooks/useBranchPrAutoLink.ts`
- `src/features/sessions/ui/LinkedWorkItemBlock.tsx` — the hover card's linked issue or PR block, its data and the signed-in `gh` logins
- `src/features/sessions/model/sessionPrs.ts` — the session's PR list (localStorage) and the `gh pr create` detection
- `src/features/sessions/hooks/useSessionPrs.ts` — the list with the linked item first; the transcript scan
- `src/features/sessions/ui/LinkedWorkItemList.tsx` — one block, or folded rows when there are several
- `src/features/sessions/ui/sessionCardFit.ts` — card width classes: only the block's status pills widen the card
- `src/features/sessions/model/linkedPrState.ts` — linked PR state, CI and merge conflict store (merged PRs in localStorage; checks via `fetchGithubPrChecks`)
- `src/features/sessions/ui/LinkedPrStatusPills.tsx` — merge conflict, CI and review pills row, shared by the block and the transcript chip popover
- `src/features/sessions/ui/LinkedPrStateIcon.tsx` — `useLinkedPrState`, state icon, sidebar badge content (icon only), CI and status pills of the block

## Upstream hooks
- `src/app/App.tsx` — `useBranchPrAutoLink(onSetHistorySessionLinkedWorkItem)`
- `src/features/sessions/ui/SessionPane.tsx` — `useCreatedPrScan(session.id, session.blocks)`
- `src/features/sessions/ui/SessionPane.tsx` — `sessionId: branchPrSessionId(session)` in `statusInfo`
- `src-tauri/src/fs.rs` — `mergeable` on `GitHubWorkItem`, requested by the single-item `gh pr view` only (lists leave it empty); `GithubWorkItem.mergeable` in `src/features/inbox/model/githubTasks.ts`
- `src/features/sessions/ui/TitleTabSessionHover.tsx` (fork file) — `conflicts` passed to the tab icon
- `src/features/sessions/ui/UserLinkPreview.tsx` — `GithubPrStatusPills` in `GithubWorkItemCard`, `cwd` passed to it
- `src/shared/ui/icons.tsx` — `CircleSlash` export (not-planned issue icon)
- `src/app/shell/Sidebar.tsx` — `LinkedPrBadgeContent` (with `sessionId`) in the session row's work item badge
- `src/features/sessions/ui/SessionCardPreview.tsx` — `LinkedWorkItemList` (with `sessionId`, `cwd`) after the details in place of the linked item `Detail`; `SESSION_CARD_FIT` in place of `width={260}`
- `src/features/sessions/ui/SessionStatusLine.tsx` (fork file) — `reportBranchPr` in `SessionPrLink`

## Verify
- `src/features/sessions/model/branchPrAutoLink.test.ts`, `linkedPrState.test.ts`, `sessionPrs.test.ts`
- Manual: start a session from an inbox issue, let the agent open a PR; within ~20 s the sidebar badge turns into the PR. Relink the issue from the session menu: it stays. Start a draft in a VS Code workspace whose first folder sits on a branch with a PR, pick another folder's worktree, send: the session links that worktree's PR, never the first folder's. Hover a `PR #n` chip in a message: its popover shows the CI and review pills. Hover the session: its card shows the PR block with its title, CI and review pills, and clicking the block opens the PR. A session linked to an issue shows the issue's labels instead. Merge that PR: within ~3 min the badge and the card's PR block turn violet. A draft PR's badge is grey with the draft icon; push to an open PR's branch and its icon gets an amber pulsing dot, then a green check or red cross once CI ends. Make an open PR conflict with its base: once the window regains focus (or within 3 min), its icon gets a red `!` and the hover card a "Merge conflicts" pill; resolve it and both go away. Have the agent open a second PR in another repo with `gh pr create`: the badge shows `+1`, the card folds both PRs into lines, each line's button opens its PR and clicking a line unfolds it. Ask the agent to `gh pr view` a third PR: it is not listed.
