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

## Full-screen terminal apps keep their last row visible
- `src/features/terminal/model/terminalLayout.ts` — `fitTerminal`: TUI mode resets the grid stretch, rounds cols/rows down like shell mode, then `stretchGridToHost` fills the gap (rounding up pushed the last row under the host's `overflow: hidden`)
- Manual: open `vim` in a terminal tab and type `:`; the command line shows in full, also after resizing the panel.

## Claude side questions answer without tools
- `src/integrations/harness/providers/claude/claudeText.ts` — `textSettings`: the read-only (`/btw`) runner adds `tools: []` next to `maxTurns: 1`, like the Claude Code CLI's `/btw`. A tool call used to end the single turn with "Reached maximum number of turns (1)"
- `src/integrations/harness/providers/claude/claudeProtocol.ts` — `tools` option in `buildClaudeSpawnArgs` (`--tools`)
- `src/integrations/harness/providers/claude/claudeProtocol.test.ts`
- Manual: in a Claude session, ask a `/btw` question that would need a file read; it answers (or says what it lacks) instead of "Couldn't finish".

## Session title ellipsis sits against the row's trailing icons
- `src/app/shell/Sidebar.tsx` — `SessionCard`: the dense title's `ParticleText` uses `truncate` instead of `line-clamp-1`, which cut at the last whole word and left a gap before the time
- Manual: with a long session title, the `…` touches the time/PR icon, hovered or not.

## Middle-clicked links open in the browser
- `src/main.tsx`, `src/features/monos/floatingMain.tsx`, `src/features/quick-composer/main.tsx` — `installMiddleClickLinkGuard()` next to `installNativeContextMenuGuard()`: the webview used to load a middle-clicked link in place of the app
- Fork files: `src/shared/lib/middleClickLinks.ts`
- `src/shared/lib/middleClickLinks.test.ts`
- Manual: middle-click a link or a `#123` reference in a session; it opens in the default browser and the app stays put.

## A subagent's approval keeps the main reply whole
- `src/integrations/harness/core/apply.ts` — `leavesStreamOpen` in `appendBlock`, `patchStreaming`, `sealLastStream`: a tool row arriving with its approval (a subagent's) no longer seals the streaming reply
- `src/integrations/harness/core/apply.test.ts` — "keeps a reply whole when a subagent asks for approval mid-stream"
- Manual: while a Claude reply streams, have a background subagent ask for approval; the reply stays one block.

## Clippy `needless_bool` on Rust 1.100
- `src-tauri/src/link_preview.rs` — `is_public_ipv6` returns `!(…)` instead of `if … { return false; } true`
- `crates/monocode-core/src/provider.rs` — `executable`: `meta.is_file()` folded into each `cfg` branch
- On sync: keep upstream's version once it fixes the same lint.
- `cargo clippy --workspace --all-targets -- -D warnings` on stable ≥ 1.100 (CI `check` and `Core (windows-latest)`)
