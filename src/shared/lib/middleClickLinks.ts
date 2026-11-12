import { openUrl } from "@tauri-apps/plugin-opener";

/**
 * A middle click on a link makes the webview load it in place of the app.
 * Bubble phase on the window, so handlers that already took the click win.
 */
export function installMiddleClickLinkGuard(
  target: Window = window,
  open: (url: string) => Promise<void> = openUrl,
): () => void {
  const onMiddleClick = (event: MouseEvent) => {
    if (event.button !== 1 || event.defaultPrevented) return;
    const link =
      event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>("a[href]")
        : null;
    if (!link) return;
    event.preventDefault();
    const href = link.getAttribute("href") ?? "";
    if (/^https?:\/\//i.test(href)) void open(href).catch(() => undefined);
  };
  // WebKit follows a middle-clicked link from `auxclick` or `click`, by version.
  target.addEventListener("auxclick", onMiddleClick);
  target.addEventListener("click", onMiddleClick);
  return () => {
    target.removeEventListener("auxclick", onMiddleClick);
    target.removeEventListener("click", onMiddleClick);
  };
}
