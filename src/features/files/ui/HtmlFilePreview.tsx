import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useFrameTheme } from "../../artifacts/ui/HtmlArtifactFrame";

const SYNC_DELAY_MS = 250;

export function isHtmlFilePath(path: string): boolean {
  return /\.html?$/i.test(path);
}

/** Served by the artifact scheme, so the page gets the same sandbox and CSP as an `html` artifact. */
function previewUrl(key: string, version: number): string {
  return `${convertFileSrc("", "monoartifact")}file-preview/${key}?v=${version}`;
}

/**
 * Renders the editor's current HTML, saved or not, in a sandboxed frame.
 * Relative assets (`./style.css`) do not load: the page only reaches https URLs.
 */
export function HtmlFilePreview({
  source,
  title,
  active,
}: {
  source: string;
  title: string;
  active: boolean;
}) {
  const [key] = useState(() => crypto.randomUUID());
  const [version, setVersion] = useState(0);
  const syncedSource = useRef<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const theme = useFrameTheme();
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const postTheme = () =>
    frameRef.current?.contentWindow?.postMessage(
      { type: "monocode:theme", ...themeRef.current },
      "*",
    );
  useEffect(postTheme, [theme]);

  useEffect(() => {
    if (!active || syncedSource.current === source) return;
    const timer = window.setTimeout(
      () => {
        invoke("html_file_preview_set", { key, body: source })
          .then(() => {
            syncedSource.current = source;
            setVersion((v) => v + 1);
          })
          .catch(() => undefined);
      },
      syncedSource.current === null ? 0 : SYNC_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [active, key, source]);

  useEffect(
    () => () =>
      void invoke("html_file_preview_clear", { key }).catch(() => undefined),
    [key],
  );

  useLayoutEffect(() => {
    const receive = (event: MessageEvent) => {
      const frame = frameRef.current;
      if (!frame || event.source !== frame.contentWindow) return;
      const data = event.data as { type?: unknown; url?: unknown } | null;
      if (data?.type === "monocode:ready") postTheme();
      else if (
        data?.type === "monocode:open-link" &&
        typeof data.url === "string" &&
        /^https?:\/\//i.test(data.url) &&
        document.activeElement === frame
      )
        void openUrl(data.url).catch(() => undefined);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);

  if (version === 0) return null;
  return (
    <iframe
      ref={frameRef}
      data-html-file-preview=""
      src={previewUrl(key, version)}
      title={title}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      onLoad={postTheme}
      className="block h-full w-full border-0"
      style={{ colorScheme: theme.scheme }}
    />
  );
}
