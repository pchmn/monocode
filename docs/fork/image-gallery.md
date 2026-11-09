# Image gallery

Opening an image of a message (sent photo, attachment chip, or `[Image #N]` token in a sent message or the composer) lets you step through the message's other images with ←/→ or the side arrows, with an `n / total` counter.

## Fork files
- `src/features/sessions/ui/ImageGallery.tsx` — wraps `ImageLightbox`, keyed per image so zoom resets

## Upstream hooks
- `src/shared/ui/ImageLightbox.tsx` — `children` rendered inside the dialog (navigation overlay)
- `src/features/sessions/ui/AttachmentChip.tsx` — `gallery` prop, `ImageGallery` instead of `ImageLightbox`
- `src/features/sessions/ui/AgentTranscript.tsx` — `gallery={block.attachments}` on the `AttachmentChip`s of `UserMessageBlock`

Fork-file hooks: `useImageTokenPreview().open(file, attachments)` (`ImageTokenPreview.tsx`), called by `SentImageTokens` and `openImageAtCaret`.

## Verify
- `src/features/sessions/ui/ImageGallery.test.ts`
- Manual: send a message with two pasted images, click `[Image #1]`, press → : image 2 shows with `2 / 2`.
