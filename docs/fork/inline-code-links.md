# Inline code links

In rendered Markdown, inline code naming a web address (`https://…`, or a lowercase bare domain on a common web TLD such as `console.preview.example.com`) opens in the browser instead of being taken for a file, with Open in Browser, Copy Link and Copy Text on right-click. File links' context menu also offers Copy Text, the text as shown.

## Fork files
- `src/features/sessions/model/inlineCodeUrl.ts` — URL / bare-domain detection; TLDs that are also file extensions (`.sh`, `.md`…) stay files
- `src/features/sessions/ui/InlineCodeUrl.tsx` — clickable inline code with its own context menu

## Upstream hooks
- `src/features/sessions/ui/AgentMarkdown.tsx` — `inlineCodeUrl` branch in `MarkdownCode`; `copy-text` item in `fileLinkMenuItems` and `onFileMenuPick`; `text` field on `FileLinkMenu` and extra `text` argument to `onFileContextMenu` (passed by `MarkdownLink`, `MarkdownCode`, `MarkdownCodePath`)

## Verify
- `src/features/sessions/model/inlineCodeUrl.test.ts`
- Manual: ask the agent to write `example.com` and `package.json` in backticks. The first opens the browser, the second the file; right-click on either offers Copy Text.
