# GitHub issue and PR mentions

Typing `#` in the composer suggests the issues and pull requests of the project's GitHub repo, open only or all (toggle in the picker or ⌥A, remembered). A number filters by number prefix, text by title; after a short pause the query also runs as a GitHub search (exact lookup for a number). Picking one writes `#123`.

In rendered Markdown with a project (chat replies, previews), a `#123` that names an existing issue or PR of the repo becomes a link to it, with its title as tooltip; other `#123` stay plain text.

In a sent message, each `#123` naming an existing issue or PR shows as the same chip (with hover card) as a pasted GitHub issue or PR URL; the first URL, if any, keeps its chip too. A pasted image token (`[Image #1]`) is not a reference.

## Fork files
- `src/features/sessions/model/issueMentions.ts` — `#` token detection, ranking, scope, cached `gh` listing and search (reuses `git_github_work_items`, `git_github_work_item`)
- `src/features/sessions/hooks/useIssueMentions.ts` — picker state, scope, debounced search, keyboard handling
- `src/features/sessions/ui/IssueMentionPicker.tsx`
- `src/features/sessions/model/issueReferences.ts` — remark plugin turning `#123` into links, cached existence lookup (reuses the mention listing and number lookup)
- `src/features/sessions/ui/IssueReferenceLink.tsx`
- `src/features/sessions/hooks/useUserMessageLink.ts` — upstream `parseUserMessageLink`, plus every resolved `#123`
- `src/features/sessions/ui/UserMessageLinkTail.tsx` — renders the text after the main chip with the extra chips

## Upstream hooks
- `src/features/sessions/ui/Composer.tsx` — `useIssueMentions` (with `onIssueReplace`), `issueMentions.sync` in `syncTokensFromTextarea`, `issueMentions.onKeyDown` before the `mentionOpen` key branch, `IssueMentionPicker` rendered beside `FileMentionPicker`
- `src/features/sessions/ui/AgentMarkdown.tsx` — `remarkIssueReferences` in `remarkPlugins` when `cwd` is set, `IssueReferenceLink` branch in `MarkdownLink`
- `src/features/sessions/ui/AgentTranscript.tsx` — `useUserMessageLink` replaces `parseUserMessageLink` in `UserMessageBlock`, `UserMessageLinkTail` renders `afterText`

## Verify
- `src/features/sessions/model/issueMentions.test.ts`, `src/features/sessions/model/issueReferences.test.ts`
- Manual: in a GitHub project, type `#` then a few letters of an issue title; Enter writes `#<number>`. Switch to All with ⌥A and type the number of a merged PR: it appears.
- Manual: ask the agent to mention an existing PR and a nonexistent number (`#99999`): the first is a link opening GitHub, the second plain text.
- Manual: send `implemente #<existing issue>`: the message shows an `Issue #<n>` chip, as with the issue URL. Send `#<a> #<b>`: both show as chips.
