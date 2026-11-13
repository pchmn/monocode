import type { Extension } from "@codemirror/state";
import { EditorView, hoverTooltip } from "@codemirror/view";
import { invoke } from "@tauri-apps/api/core";
import { languageForPath } from "./editorLanguage";
import { markLspSynced, supportsGoToDefinition } from "./editorGoToDefinition";
import { highlightSource } from "./syntaxTokens";

const HOVER_DELAY_MS = 300;

export function editorHover(path: string): Extension {
  if (!supportsGoToDefinition(path)) return [];
  return [
    hoverTooltip(
      async (view, pos) => {
        const word = view.state.wordAt(pos);
        if (!word) return null;
        const line = view.state.doc.lineAt(pos);
        markLspSynced(view);
        let markdown: string | null;
        try {
          markdown = await invoke<string | null>("lsp_hover", {
            request: {
              path,
              text: view.state.doc.toString(),
              line: line.number - 1,
              character: pos - line.from,
            },
          });
        } catch {
          return null;
        }
        if (!markdown) return null;
        const dom = await renderHover(markdown);
        return {
          pos: word.from,
          end: word.to,
          above: true,
          create: () => ({ dom }),
        };
      },
      { hoverTime: HOVER_DELAY_MS },
    ),
    hoverTheme,
  ];
}

type Segment = { code: string; language: string } | { text: string };

export function hoverSegments(markdown: string): Segment[] {
  const segments: Segment[] = [];
  const fence = /```(\w*)\n([\s\S]*?)\n?```/g;
  let last = 0;
  for (const match of markdown.matchAll(fence)) {
    const text = markdown.slice(last, match.index).trim();
    if (text) segments.push({ text });
    segments.push({ language: match[1] ?? "", code: match[2] ?? "" });
    last = (match.index ?? 0) + match[0].length;
  }
  const rest = markdown.slice(last).trim();
  if (rest) segments.push({ text: rest });
  return segments;
}

async function renderHover(markdown: string): Promise<HTMLElement> {
  const dom = document.createElement("div");
  dom.className = "cm-lsp-hover";
  for (const segment of hoverSegments(markdown)) {
    if ("code" in segment) {
      const language = await languageForPath(
        `hover.${extensionFor(segment.language)}`,
      );
      const pre = document.createElement("pre");
      pre.className = "cm-lsp-hover-code";
      highlightSource(segment.code, language).forEach((tokens, index) => {
        if (index > 0) pre.append("\n");
        for (const token of tokens) {
          const span = document.createElement("span");
          span.textContent = token.text;
          if (token.color) span.style.color = token.color;
          pre.append(span);
        }
      });
      dom.append(pre);
    } else {
      dom.append(renderText(segment.text));
    }
  }
  return dom;
}

function extensionFor(language: string): string {
  if (language === "typescript" || language === "ts") return "ts";
  if (language === "tsx" || language === "typescriptreact") return "tsx";
  if (language === "javascript" || language === "js") return "js";
  return language || "txt";
}

// JSDoc arrives as light Markdown: `code`, *emphasis* and **strong** only.
function renderText(text: string): HTMLElement {
  const block = document.createElement("div");
  block.className = "cm-lsp-hover-text";
  for (const part of text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/)) {
    if (!part) continue;
    if (part.startsWith("`")) {
      const code = document.createElement("code");
      code.textContent = part.slice(1, -1);
      block.append(code);
    } else if (part.startsWith("**")) {
      const strong = document.createElement("strong");
      strong.textContent = part.slice(2, -2);
      block.append(strong);
    } else if (part.startsWith("*")) {
      const em = document.createElement("em");
      em.textContent = part.slice(1, -1);
      block.append(em);
    } else {
      block.append(part);
    }
  }
  return block;
}

const hoverTheme = EditorView.theme({
  ".cm-tooltip.cm-tooltip-hover:has(.cm-lsp-hover)": {
    maxWidth: "min(720px, 90vw)",
  },
  ".cm-tooltip-above.cm-tooltip-hover:has(.cm-lsp-hover)": {
    marginTop: "-4px",
  },
  ".cm-tooltip-below.cm-tooltip-hover:has(.cm-lsp-hover)": {
    marginTop: "4px",
  },
  ".cm-lsp-hover": {
    maxHeight: "360px",
    overflow: "auto",
    padding: "8px 12px",
    lineHeight: "1.55",
  },
  ".cm-lsp-hover-code": {
    margin: "0",
    fontFamily: "var(--font-mono)",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  ".cm-lsp-hover-text": {
    whiteSpace: "pre-wrap",
    marginTop: "8px",
    paddingTop: "8px",
    borderTop:
      "1px solid color-mix(in srgb, var(--color-content) 12%, transparent)",
  },
});
