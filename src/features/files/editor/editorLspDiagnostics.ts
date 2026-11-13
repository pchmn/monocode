import {
  forEachDiagnostic,
  linter,
  type Action,
  type Diagnostic,
} from "@codemirror/lint";
import type { LSPPlugin } from "@codemirror/lsp-client";
import {
  StateEffect,
  type EditorState,
  type Extension,
  type Text,
} from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type * as lsp from "vscode-languageserver-protocol";
import { openQuickFix } from "./editorQuickFix";
import { isLspServed, lspRequest } from "./lsp/languageServer";

// TypeScript's "declared but never read" and "unreachable code" family, faded like VS Code.
const UNNECESSARY_CODES = new Set([
  6133, 6138, 6192, 6196, 6198, 6199, 6205, 7027, 7028,
]);
const UNNECESSARY_TAG = 1;
const DEPRECATED_TAG = 2;

const SEVERITIES = ["error", "error", "warning", "info", "hint"] as const;

type ServerDiagnostic = lsp.Diagnostic;

const serverDiagnostics = new WeakMap<Diagnostic, ServerDiagnostic>();
const lintedDocs = new WeakMap<EditorView, Text>();

const refreshDiagnostics = StateEffect.define<null>();

/**
 * tsgo's diagnostics for a file it serves, otherwise `fallback`'s. One source
 * for both so the syntax lint never doubles tsgo's errors.
 */
export function withLspDiagnostics(
  fallback: (view: EditorView) => Diagnostic[],
): (view: EditorView) => Promise<Diagnostic[]> {
  return (view) => lspDiagnostics(view, () => fallback(view));
}

async function lspDiagnostics(
  view: EditorView,
  fallback: () => Diagnostic[],
): Promise<Diagnostic[]> {
  let doc: Text | null = null;
  let response;
  try {
    response = await lspRequest<lsp.DocumentDiagnosticReport | null>(
      view,
      "textDocument/diagnostic",
      (plugin) => {
        doc = plugin.view.state.doc;
        return { textDocument: { uri: plugin.uri } };
      },
      { background: true },
    );
  } catch {
    response = undefined;
  }
  if (!response || !doc) {
    return isLspServed(view) ? currentDiagnostics(view.state) : fallback();
  }
  const items =
    response.result && "items" in response.result ? response.result.items : [];
  const edited = lintedDocs.has(view) && lintedDocs.get(view) !== doc;
  lintedDocs.set(view, doc);
  if (edited) refreshOtherFiles(response.plugin);
  const syncedDoc: Text = doc;
  return items.map((item) => toDiagnostic(syncedDoc, item));
}

// A failed pull keeps what tsgo last reported rather than blanking it.
function currentDiagnostics(state: EditorState): Diagnostic[] {
  const found: Diagnostic[] = [];
  forEachDiagnostic(state, (diagnostic, from, to) => {
    const kept = { ...diagnostic, from, to };
    const item = serverDiagnostics.get(diagnostic);
    if (item) serverDiagnostics.set(kept, item);
    found.push(kept);
  });
  return found;
}

function toDiagnostic(doc: Text, item: ServerDiagnostic): Diagnostic {
  const from = clampedOffset(doc, item.range.start);
  const to = clampedOffset(doc, item.range.end);
  const severity = SEVERITIES[item.severity ?? 1] ?? "error";
  const unnecessary =
    item.tags?.includes(UNNECESSARY_TAG) ||
    (severity === "hint" && UNNECESSARY_CODES.has(Number(item.code)));
  const deprecated = item.tags?.includes(DEPRECATED_TAG);
  const diagnostic: Diagnostic = {
    from,
    to,
    severity,
    message:
      typeof item.message === "string" ? item.message : item.message.value,
    source:
      item.code == null ? item.source : `${item.source ?? "ts"}(${item.code})`,
    markClass: unnecessary
      ? "cm-lsp-unnecessary"
      : deprecated
        ? "cm-lsp-deprecated"
        : undefined,
    actions:
      severity === "hint" && !unnecessary ? undefined : [QUICK_FIX_ACTION],
  };
  serverDiagnostics.set(diagnostic, item);
  return diagnostic;
}

// tsgo may point one line past the end for a missing token at the end of the file.
function clampedOffset(doc: Text, { line, character }: lsp.Position): number {
  const target = doc.line(Math.min(line + 1, doc.lines));
  return target.from + Math.min(character, target.length);
}

const QUICK_FIX_ACTION: Action = {
  name: "Quick Fix…",
  apply: (view, from, to) => void openQuickFix(view, from, to),
};

// Another file's types may depend on the one just edited.
function refreshOtherFiles(plugin: LSPPlugin) {
  for (const file of plugin.client.workspace.files) {
    const view = file.getView();
    if (view && view !== plugin.view) {
      view.dispatch({ effects: refreshDiagnostics.of(null) });
    }
  }
}

/** The tsgo diagnostics touching `from`–`to`, ranges updated to the current document. */
export function serverDiagnosticsAt(
  state: EditorState,
  plugin: LSPPlugin,
  from: number,
  to: number,
): ServerDiagnostic[] {
  const found: ServerDiagnostic[] = [];
  forEachDiagnostic(state, (diagnostic, start, end) => {
    const item = serverDiagnostics.get(diagnostic);
    if (!item || end < from || start > to) return;
    found.push({
      ...item,
      range: {
        start: plugin.toPosition(start, state.doc),
        end: plugin.toPosition(end, state.doc),
      },
    });
  });
  return found;
}

/** Errors only: hints flag unused code and warnings are rare in TS. */
export function lintErrorCount(state: EditorState): number {
  let count = 0;
  forEachDiagnostic(state, (diagnostic) => {
    if (diagnostic.severity === "error") count += 1;
  });
  return count;
}

export const editorLspDiagnostics: Extension = [
  linter(null, {
    needsRefresh: (update) =>
      update.transactions.some((tr) =>
        tr.effects.some((effect) => effect.is(refreshDiagnostics)),
      ),
  }),
  EditorView.theme({
    ".cm-lintRange-hint": { backgroundImage: "none" },
    ".cm-lintRange-warning": {
      backgroundImage: "none",
      textDecoration: "underline wavy #fbbf24",
      textDecorationSkipInk: "none",
      textUnderlineOffset: "3px",
    },
    ".cm-lintRange.cm-lsp-unnecessary": {
      backgroundImage: "none",
      textDecoration: "none",
      opacity: "0.55",
    },
    ".cm-lintRange.cm-lsp-deprecated": {
      backgroundImage: "none",
      textDecoration: "line-through",
    },
    ".cm-tooltip-lint .cm-diagnostic-warning": {
      borderLeft: "2px solid #fbbf24",
    },
    ".cm-tooltip-lint .cm-diagnostic-hint, .cm-tooltip-lint .cm-diagnostic-info":
      {
        borderLeft:
          "2px solid color-mix(in srgb, var(--color-content) 40%, transparent)",
      },
    ".cm-diagnosticSource": {
      opacity: "0.6",
    },
    ".cm-diagnosticAction": {
      font: "inherit",
      fontFamily: "var(--font-sans, inherit)",
      backgroundColor:
        "color-mix(in srgb, var(--color-accent) 25%, transparent)",
      color: "var(--color-content)",
      borderRadius: "4px",
      padding: "0 6px",
      marginLeft: "8px",
    },
  }),
];
