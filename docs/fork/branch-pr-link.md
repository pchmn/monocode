# Session linked to its branch's PR

When the PR of a session's branch is found (the `PR #n` under the composer), the session's GitHub link switches to that PR, replacing its issue or filling an empty link: the sidebar badge, update dot and activity card then follow the PR. Each session and PR pair is linked once, so relinking the issue by hand sticks.

In the session hover card, the linked issue or PR is a block under the details: `repo #n` with its state pill, its title on two lines and, for a PR, a CI pill and a review pill that name what they measure ("CI failed", "Review awaiting"), then the author when it isn't one of the `gh` accounts, and the last update. A linked issue shows up to two of its labels instead of the pills. Clicking the block opens it on GitHub.

A linked PR's sidebar badge, title-tab icon and hover-card block show its state: green when open, grey draft icon while a draft, violet merge icon once merged, red once closed. While open or draft, a small tinted chip cut into the icon's bottom-right corner gives its CI rollup (amber pulsing dot while checks run, soft red cross once one fails, green check once they pass). The icon stands alone: the sidebar badge drops the PR number; its tooltip reads e.g. "Open · CI running". Each visible PR is fetched every 3 minutes until merged, every 45 s while its CI runs; merged PRs are remembered across launches and never fetched again.

## Fork files
- `src/features/sessions/model/branchPrAutoLink.ts` — PR report channel, once-per-pair guard (localStorage)
- `src/features/sessions/hooks/useBranchPrAutoLink.ts`
- `src/features/sessions/ui/LinkedWorkItemBlock.tsx` — the hover card's linked issue or PR block, its data and the signed-in `gh` logins
- `src/features/sessions/ui/sessionCardFit.ts` — card width classes: only the block's status pills widen the card
- `src/features/sessions/model/linkedPrState.ts` — linked PR state and CI store (merged PRs in localStorage; checks via `fetchGithubPrChecks`)
- `src/features/sessions/ui/LinkedPrStateIcon.tsx` — `useLinkedPrState`, state icon, sidebar badge content (icon only), CI and status pills of the block

## Upstream hooks
- `src/app/App.tsx` — `useBranchPrAutoLink(onSetHistorySessionLinkedWorkItem)`
- `src/features/sessions/ui/SessionPane.tsx` — `sessionId` in `statusInfo`
- `src/app/shell/Sidebar.tsx` — `LinkedPrBadgeContent` in the session row's work item badge
- `src/features/sessions/ui/SessionCardPreview.tsx` — `LinkedWorkItemBlock` (with `cwd`) after the details in place of the linked item `Detail`; `SESSION_CARD_FIT` in place of `width={260}`
- `src/features/sessions/ui/SessionStatusLine.tsx` (fork file) — `reportBranchPr` in `SessionPrLink`

## Verify
- `src/features/sessions/model/branchPrAutoLink.test.ts`, `linkedPrState.test.ts`
- Manual: start a session from an inbox issue, let the agent open a PR; within ~20 s the sidebar badge turns into the PR. Relink the issue from the session menu: it stays. Hover the session: its card shows the PR block with its title, CI and review pills, and clicking the block opens the PR. A session linked to an issue shows the issue's labels instead. Merge that PR: within ~3 min the badge and the card's PR block turn violet. A draft PR's badge is grey with the draft icon; push to an open PR's branch and its icon gets an amber pulsing dot, then a green check or red cross once CI ends.
