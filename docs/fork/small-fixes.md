# Small fixes

Upstream bug fixes with no feature of their own. On each sync, check whether upstream fixed the same bug; if so, keep upstream's version.

## Focusing a session tab switches project (PR #23)
- `src/app/App.tsx` — `setProjectCwd(normalizeProjectPath(cwd))` when focusing a session (comment "Title tabs are filtered by projectCwd")
- Manual: with two projects, focus a session tab of the other project; the sidebar follows.

## Autocorrect setting in question answers (PR #27)
- `src/features/sessions/ui/QuestionForm.tsx` — `useComposerAutocorrect`, `spellCheck` / `autoCorrect` on both answer fields in `QuestionFields`

## Inbox card labels stay inside the card (PR #35)
- `src/features/inbox/ui/InboxView.tsx` — `max-w-[55%] overflow-hidden` on the label span in `InboxCard`
