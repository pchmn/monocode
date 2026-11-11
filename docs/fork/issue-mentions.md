# GitHub issue and PR mentions

Typing `#` in the composer suggests the issues and pull requests of the project's GitHub repo, open only or all (toggle in the picker or ⌥A, remembered). A number filters by number prefix, text by title; after a short pause the query also runs as a GitHub search (exact lookup for a number). Picking one writes `#123`.

## Fork files
- `src/features/sessions/model/issueMentions.ts` — `#` token detection, ranking, scope, cached `gh` listing and search (reuses `git_github_work_items`, `git_github_work_item`)
- `src/features/sessions/hooks/useIssueMentions.ts` — picker state, scope, debounced search, keyboard handling
- `src/features/sessions/ui/IssueMentionPicker.tsx`

## Upstream hooks
- `src/features/sessions/ui/Composer.tsx` — `useIssueMentions` (with `onIssueReplace`), `issueMentions.sync` in `syncTokensFromTextarea`, `issueMentions.onKeyDown` before the `mentionOpen` key branch, `IssueMentionPicker` rendered beside `FileMentionPicker`

## Verify
- `src/features/sessions/model/issueMentions.test.ts`
- Manual: in a GitHub project, type `#` then a few letters of an issue title; Enter writes `#<number>`. Switch to All with ⌥A and type the number of a merged PR: it appears.
