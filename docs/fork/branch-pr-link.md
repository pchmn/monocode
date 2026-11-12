# Session linked to its branch's PR

When the PR of a session's branch is found (the `PR #n` under the composer), the session's GitHub link switches to that PR, replacing its issue or filling an empty link: the sidebar badge, update dot and activity card then follow the PR. Each session and PR pair is linked once, so relinking the issue by hand sticks.

In the session hover card, the linked issue or PR opens on GitHub.

## Fork files
- `src/features/sessions/model/branchPrAutoLink.ts` — PR report channel, once-per-pair guard (localStorage)
- `src/features/sessions/hooks/useBranchPrAutoLink.ts`
- `src/features/sessions/ui/LinkedWorkItemLink.tsx`

## Upstream hooks
- `src/app/App.tsx` — `useBranchPrAutoLink(onSetHistorySessionLinkedWorkItem)`
- `src/features/sessions/ui/SessionPane.tsx` — `sessionId` in `statusInfo`
- `src/features/sessions/ui/SessionCardPreview.tsx` — `LinkedWorkItemLink` in the linked item `Detail`
- `src/features/sessions/ui/SessionStatusLine.tsx` (fork file) — `reportBranchPr` in `SessionPrLink`

## Verify
- `src/features/sessions/model/branchPrAutoLink.test.ts`
- Manual: start a session from an inbox issue, let the agent open a PR; within ~20 s the sidebar badge turns into the PR. Relink the issue from the session menu: it stays. Hover the session: the PR line of its card opens the PR.
