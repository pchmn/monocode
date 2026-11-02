# Parent directories in @ mentions

`@../` in the composer browses parent directories of the project, one level at a time. (PR #5)

## Fork files
- `src/features/files/model/parentMentions.ts` — `parentMentionLines`
- `src/features/sessions/ui/useParentMentions.ts` — `useParentMentions`, `parentMentionPick`

## Upstream hooks
- `src/features/files/model/fileMentions.ts` — exported `MAX_PICKER` and `isTokenSafe`, `parentMentionLines` appended in `applyFileMentionsToTurn` (its early return on no files removed)
- `src/features/sessions/ui/Composer.tsx` — `useParentMentions` feeding `rankedFiles` (`parentFiles ?? localFiles`), `parentMentionPick` in the mention-pick handler (stays open when `intoDir`)

## Verify
- `src/features/files/model/parentMentions.test.ts`
- Manual: type `@../`; the picker lists the parent folder, picking a folder descends into it.
