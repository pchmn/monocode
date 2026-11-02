# Small fixes

Upstream bug fixes with no feature of their own. On each sync, check whether upstream fixed the same bug; if so, keep upstream's version.

## Focusing a session tab switches project (PR #23)
- `src/app/App.tsx` — `setProjectCwd(normalizeProjectPath(cwd))` when focusing a session (comment "Title tabs are filtered by projectCwd")
- Manual: with two projects, focus a session tab of the other project; the sidebar follows.

## Autocorrect setting in question answers (PR #27)
- `src/features/sessions/ui/QuestionForm.tsx` — `useComposerAutocorrect`, `spellCheck` / `autoCorrect` on both answer fields in `QuestionFields`

## Inbox card labels stay inside the card (PR #35)
- `src/features/inbox/ui/InboxView.tsx` — `max-w-[55%] overflow-hidden` on the label span in `InboxCard`

## Tab spacing
- `src/app/shell/TitleBar.tsx` — `gap-1` on the `data-title-tab-strip` row, no `ml-0.5` on the New session button: tabs sit as far apart as the last tab and `+`
- `src/features/workspace/ui/SurfaceTabs.tsx` — `gap-1 … pl-[3px]` on the tablist: same gap, and the first tab is inset from the left as much as from the top
- Manual: open several top tabs and file tabs; gaps between tabs match the gap before `+`, and the first sub-tab's left margin matches its top margin.
