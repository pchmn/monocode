import { openUrl } from "@tauri-apps/plugin-opener";
import { useState, type ComponentProps } from "react";
import { copyText } from "../../../platform/tauri/clipboard";
import { ExplorerMenu, type ExplorerMenuItem } from "../../files/ui/ExplorerMenu";

const MENU_ITEMS: ExplorerMenuItem[] = [
  { kind: "item", id: "open", label: "Open in Browser" },
  { kind: "sep" },
  { kind: "item", id: "copy-link", label: "Copy Link" },
  { kind: "item", id: "copy-text", label: "Copy Text" },
];

function open(url: string) {
  void openUrl(url).catch((error) => {
    console.error("Failed to open web link:", error);
  });
}

/** Inline code naming a web address, opened in the browser rather than as a file. */
export function InlineCodeUrl({
  url,
  text,
  className,
  children,
  onContextMenu,
  ...props
}: ComponentProps<"code"> & { url: string; text: string }) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  return (
    <>
      <code
        {...props}
        dir="ltr"
        title={url}
        // Mirrors the inline `code` style of MarkdownCode in AgentMarkdown.
        className={`inline-flex items-center gap-1 rounded-md bg-content/8 px-1.5 min-h-6 max-w-full [overflow-wrap:anywhere] align-baseline font-mono text-[0.8em] text-content cursor-pointer hover:text-sky-300 hover:underline ${className ?? ""}`}
        role="link"
        tabIndex={0}
        onClick={() => open(url)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          open(url);
        }}
        onContextMenu={(event) => {
          onContextMenu?.(event);
          if (event.defaultPrevented) return;
          event.preventDefault();
          event.stopPropagation();
          setMenu({ x: event.clientX, y: event.clientY });
        }}
      >
        {children}
      </code>
      {menu ? (
        <ExplorerMenu
          x={menu.x}
          y={menu.y}
          items={MENU_ITEMS}
          ariaLabel="Link actions"
          onPick={(id) => {
            setMenu(null);
            if (id === "open") open(url);
            else void copyText(id === "copy-link" ? url : text);
          }}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </>
  );
}
