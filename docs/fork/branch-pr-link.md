# Session linked to its branch's PR

When the PR of a session's branch is found (the `PR #n` under the composer), the session's GitHub link switches to that PR, replacing its issue or filling an empty link: the sidebar badge, update dot and activity card then follow the PR. Each session and PR pair is linked once, so relinking the issue by hand sticks.

In the session hover card, the linked issue or PR opens on GitHub, and hovering it shows the same GitHub preview card as an issue or PR chip in a message.

A linked PR's sidebar badge, title-tab icon and hover-card line show its state: violet merge icon once merged, red once closed. Each visible PR is fetched every 3 minutes until merged; merged PRs are remembered across launches and never fetched again.

## Fork files
- `src/features/sessions/model/branchPrAutoLink.ts` — PR report channel, once-per-pair guard (localStorage)
- `src/features/sessions/hooks/useBranchPrAutoLink.ts`
- `src/features/sessions/ui/LinkedWorkItemLink.tsx` — link and its hover preview (reuses `GithubWorkItemCard`)
- `src/features/sessions/model/linkedPrState.ts` — linked PR state store (merged PRs in localStorage)
- `src/features/sessions/ui/LinkedPrStateIcon.tsx` — `useLinkedPrState`, state icon, sidebar badge content

## Upstream hooks
- `src/app/App.tsx` — `useBranchPrAutoLink(onSetHistorySessionLinkedWorkItem)`
- `src/features/sessions/ui/SessionPane.tsx` — `sessionId` in `statusInfo`
- `src/app/shell/Sidebar.tsx` — `LinkedPrBadgeContent` in the session row's work item badge
- `src/features/sessions/ui/SessionCardPreview.tsx` — `LinkedWorkItemLink` (with `cwd`) in the linked item `Detail`
- `src/features/sessions/ui/UserLinkPreview.tsx` — `GithubWorkItemCard` exported
- `src/features/sessions/ui/SessionStatusLine.tsx` (fork file) — `reportBranchPr` in `SessionPrLink`

## Verify
- `src/features/sessions/model/branchPrAutoLink.test.ts`, `linkedPrState.test.ts`
- Manual: start a session from an inbox issue, let the agent open a PR; within ~20 s the sidebar badge turns into the PR. Relink the issue from the session menu: it stays. Hover the session: the PR line of its card opens the PR, and hovering that line shows its preview card. Merge that PR: within ~3 min the badge and the card's PR line turn violet.
