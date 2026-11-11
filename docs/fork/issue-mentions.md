# GitHub issue and PR mentions

Typing `#` in the composer suggests the open issues and pull requests of the project's GitHub repo; a number filters by number prefix, text by title. Picking one writes `#123`.

## Fork files
- `src/features/sessions/model/issueMentions.ts` — `#` token detection, ranking, cached `gh` listing (reuses `git_github_work_items`)
- `src/features/sessions/hooks/useIssueMentions.ts` — picker state, loading, keyboard handling
- `src/features/sessions/ui/IssueMentionPicker.tsx`

## Upstream hooks
- `src/features/sessions/ui/Composer.tsx` — `useIssueMentions` (with `onIssueReplace`), `issueMentions.sync` in `syncTokensFromTextarea`, `issueMentions.onKeyDown` before the `mentionOpen` key branch, `IssueMentionPicker` rendered beside `FileMentionPicker`

## Verify
- `src/features/sessions/model/issueMentions.test.ts`
- Manual: in a GitHub project, type `#` then a few letters of an issue title; Enter writes `#<number>`.
