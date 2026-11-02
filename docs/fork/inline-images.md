# Inline pasted images

A pasted image is inserted as an `[Image #N]` token at the caret, sent to the agent at that position in the prompt, and previewable by clicking the token. (PR #2)

## Fork files
- `src/features/sessions/model/inlineImages.ts` — `interleaveAttachments`
- `src/features/sessions/ui/inlineImagePaste.ts` — paste, atomic token keys, orphan cleanup
- `src/features/sessions/ui/ImageTokenRuns.tsx`, `src/features/sessions/ui/ImageTokenPreview.tsx`, `src/features/sessions/ui/SentImageTokens.tsx`

## Upstream hooks
- `src/features/sessions/model/session.ts` — `imageNumber` on `Attachment`
- `src/features/sessions/model/attachments.ts` — `promptBlocks` built by `interleaveAttachments`
- `src/integrations/harness/providers/claude/claudeProtocol.ts` — `buildClaudeUserMessage` uses `interleaveAttachments`
- `src/integrations/harness/providers/codex/codexProtocol.ts` — `codexInput` uses `interleaveAttachments`
- `src/features/sessions/ui/Composer.tsx` — `pastedImageAttacher` in the paste handlers, `applyAtomicTokenKey` in key-down, `openImageAtCaret` on click, `orphanedImages` on input, `removeImageToken`, `ImageTokenRuns` in `FileMentionRuns`, `imagePreview.node`
- `src/features/sessions/ui/AgentTranscript.tsx` — `SentImageTokens` in `UserMessageBlock`
- `src/features/sessions/ui/Composer.pasteImage.test.ts` — expectation includes the `[Image #1]` token

## Verify
- `src/features/sessions/model/inlineImages.test.ts`, `src/features/sessions/ui/inlineImagePaste.test.ts`, `src/features/sessions/ui/SentImageTokens.test.ts`, `src/features/sessions/ui/Composer.pasteImage.test.ts`
- Manual: paste a screenshot mid-sentence; the token sits at the caret, deleting it removes the attachment.
