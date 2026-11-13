# HTML file preview

`.html` / `.htm` files get the same Preview / Source toggle as Markdown and SVG. The preview renders the editor's current text, saved or not, in the sandbox used for `html` artifacts: scripts run, only https resources load, so relative assets (`./style.css`) are missing.

## Fork files
- `src/features/files/ui/HtmlFilePreview.tsx` — the frame; pushes the text to the backend, then reloads
- `src/styles/htmlFilePreview.css` — opaque toggle over the page
- `src-tauri/src/html_file_preview.rs` — in-memory pages served at `monoartifact://localhost/file-preview/<key>`

## Upstream hooks
- `src/main.tsx` — `htmlFilePreview.css` import
- `src/features/files/ui/FileEditor.tsx` — `isHtmlFilePath`: adds HTML to the `markdown || svg` preview branches
- `src/features/artifacts/ui/HtmlArtifactFrame.tsx` — `useFrameTheme`: exported for the preview frame
- `src-tauri/src/artifacts.rs` — `HTML_CSP`, `with_bootstrap`: made `pub(crate)`
- `src-tauri/src/lib.rs` — `html_file_preview::serve`: tried before `artifacts::serve_html` on the artifact scheme; its two commands are registered

## Verify
- `src/features/files/ui/HtmlFilePreview.test.ts`
- `src/styles/htmlFilePreview.css` — opaque toggle over the page
- `src-tauri/src/html_file_preview.rs` (`cargo test html_file_preview`)
- Manual: open an `.html` file with an inline `<script>`, switch to Preview: the page renders and its script runs; edit the source, the preview follows.
