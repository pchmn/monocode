# Small fixes

Upstream bug fixes with no feature of their own. On each sync, check whether upstream fixed the same bug; if so, keep upstream's version.

## Focusing a session tab switches project (PR #23)
- `src/app/App.tsx` — `setProjectCwd(normalizeProjectPath(cwd))` when focusing a session (comment "Title tabs are filtered by projectCwd")
- Manual: with two projects, focus a session tab of the other project; the sidebar follows.

## Autocorrect setting in question answers (PR #27)
- `src/features/sessions/ui/QuestionForm.tsx` — `useComposerAutocorrect`, `spellCheck` / `autoCorrect` on both answer fields in `QuestionFields`

## Inbox card labels stay inside the card (PR #35)
- `src/features/inbox/ui/InboxView.tsx` — `max-w-[55%] overflow-hidden` on the label span in `InboxCard`

## Visible outcome of a Claude compaction
- `src/integrations/harness/providers/claude/claude.ts` — `compactBoundaryFromSystem` in `handleLine`'s `system` branch: status shows before/after tokens, context gauge takes `post_tokens`
- `src/features/sessions/model/transcriptActivity.ts` — `compactionSummaryLine` in `workSummaryLine`: the folded row reads "Compacted context · …" instead of "Status update"
- `src/integrations/harness/core/apply.ts` — `repeatsCompaction` in `appendStatus`: drops the app's plain "Compacted context" right after the detailed one
- Fork files: `src/integrations/harness/providers/claude/claudeCompact.ts`, `src/features/sessions/model/compactStatus.ts`
- `src/integrations/harness/providers/claude/claudeCompact.test.ts`
- Manual: `/compact` in a Claude session; the row reads "Compacted context · Xk → Yk tokens" and the token count under the composer drops.

## Claude session stopped before its first message stays usable
- `src/integrations/harness/providers/claude/claude.ts` — `noteMissingConversation` in `handleLine`, `takeMissingConversation` after `waitForInit` in `ensureLive`: a `--resume` that hits "No conversation found with session ID" relaunches with a fresh conversation instead of failing every turn with "Harness process is not running"
- Fork files: `src/integrations/harness/providers/claude/claudeMissingConversation.ts`
- `src/integrations/harness/providers/claude/claudeMissingConversation.test.ts`
- Manual: send a message in a new Claude session and press Stop within a second; the next message gets a reply.

## Branch PR lookup finds the PR
- `src-tauri/src/fs.rs` — `git_pr_status_for` passes the bare branch to `gh pr list --head` (`owner:branch` matches nothing); `parse_gh_pr_list` keeps rows whose `headRepositoryOwner` is the repo owner
- `cargo test parse_gh_pr_list`
- Manual: on a branch with a PR, `PR #n` shows after the branch name under the composer.
