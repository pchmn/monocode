import {
  autocompletion,
  insertCompletionText,
  snippet,
  type Completion,
  type CompletionResult,
  type CompletionSource,
} from "@codemirror/autocomplete";
import { LSPPlugin } from "@codemirror/lsp-client";
import { Compartment, type Extension, type Text } from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";
import type * as lsp from "vscode-languageserver-protocol";
import { renderHover } from "./editorHover";
import { lspRequest, lspServed } from "./lsp/languageServer";

// tsgo also lists " ", which would query on every space.
const TRIGGER_CHARACTERS = new Set([".", '"', "'", "`", "/", "@", "<", "#"]);
const IDENTIFIER = /[A-Za-z_$][\w$]*/;
// TypeScript's sort groups: "11" for locals and members, "15" globals, "16" auto-imports.
const BASE_SORT_GROUP = 11;

const KIND_TYPES: Record<number, string> = {
  1: "text",
  2: "method",
  3: "function",
  4: "class",
  5: "property",
  6: "variable",
  7: "class",
  8: "interface",
  9: "namespace",
  10: "property",
  12: "constant",
  13: "enum",
  14: "keyword",
  20: "enum",
  21: "constant",
  22: "class",
  25: "type",
};

/** tsgo's completions, in place of the language's own once tsgo has answered. */
export function editorLspCompletion(): Extension {
  const slot = new Compartment();
  return [
    slot.of([]),
    ViewPlugin.define((view) => ({
      update(update) {
        const served = update.transactions.some((tr) =>
          tr.effects.some((effect) => effect.is(lspServed)),
        );
        if (!served) return;
        queueMicrotask(() =>
          view.dispatch({
            effects: slot.reconfigure(
              autocompletion({ override: [lspCompletionSource] }),
            ),
          }),
        );
      },
    })),
    completionTheme,
  ];
}

export const lspCompletionSource: CompletionSource = async (context) => {
  const view = context.view;
  if (!view) return null;
  const word = context.matchBefore(IDENTIFIER);
  const typed = context.state.sliceDoc(context.pos - 1, context.pos);
  let trigger: lsp.CompletionContext;
  if (context.explicit || word) trigger = { triggerKind: 1 };
  else if (TRIGGER_CHARACTERS.has(typed)) {
    trigger = { triggerKind: 2, triggerCharacter: typed };
  } else return null;

  let pending: { plugin: LSPPlugin; params: unknown } | null = null;
  context.addEventListener("abort", () =>
    pending?.plugin.client.cancelRequest(pending.params),
  );
  let doc: Text | null = null;
  let response;
  try {
    response = await lspRequest<
      lsp.CompletionList | lsp.CompletionItem[] | null
    >(
      view,
      "textDocument/completion",
      (plugin) => {
        doc = plugin.view.state.doc;
        const params = {
          textDocument: { uri: plugin.uri },
          position: plugin.toPosition(context.pos),
          context: trigger,
        };
        pending = { plugin, params };
        return params;
      },
      { background: true },
    );
  } catch {
    return null;
  }
  if (!response?.result || !doc || context.aborted) return null;
  return completionResult(
    response.plugin,
    doc,
    response.result,
    word?.from ?? context.pos,
  );
};

export function completionResult(
  plugin: LSPPlugin,
  doc: Text,
  result: lsp.CompletionList | lsp.CompletionItem[],
  from: number,
): CompletionResult {
  const list: lsp.CompletionList = Array.isArray(result)
    ? { items: result, isIncomplete: false }
    : result;
  return {
    from,
    options: list.items.map((item) =>
      toCompletion(plugin, doc, item, list.itemDefaults),
    ),
    validFor: list.isIncomplete ? undefined : /^[\w$]*$/,
  };
}

function toCompletion(
  plugin: LSPPlugin,
  doc: Text,
  item: lsp.CompletionItem,
  defaults: lsp.CompletionList["itemDefaults"],
): Completion {
  const edit = item.textEdit;
  const range = edit ?? defaults?.editRange;
  const editRange =
    range &&
    ("replace" in range
      ? range.replace
      : "range" in range
        ? range.range
        : range);
  const editFrom = editRange ? plugin.fromPosition(editRange.start, doc) : null;
  const text =
    edit?.newText ?? item.textEditText ?? item.insertText ?? item.label;
  const isSnippet = (item.insertTextFormat ?? defaults?.insertTextFormat) === 2;
  return {
    label: item.filterText ?? item.label,
    displayLabel: item.label,
    detail: item.labelDetails?.description ?? item.labelDetails?.detail,
    type: item.kind ? KIND_TYPES[item.kind] : undefined,
    boost: boost(item.sortText),
    apply: (view, completion, from, to) => {
      const start = editFrom == null ? from : Math.min(from, editFrom);
      const resolving = resolveEdits(view, item);
      if (isSnippet) snippet(lspToSnippet(text))(view, completion, start, to);
      else view.dispatch(insertCompletionText(view.state, text, start, to));
      void resolving?.then((apply) => apply());
    },
    info: () => completionInfo(plugin, item),
  };
}

export function boost(sortText: string | undefined): number | undefined {
  if (!sortText) return undefined;
  if (sortText.startsWith("z")) return -99;
  const group = Number.parseInt(sortText, 10);
  if (Number.isNaN(group)) return undefined;
  return Math.max(-99, Math.min(99, (BASE_SORT_GROUP - group) * 5));
}

// `$1` becomes `${1}`; backslash escapes CodeMirror snippets do not know are dropped.
export function lspToSnippet(text: string): string {
  return text.replace(/\\([$}\\])|\$(\d+)/g, (_match, escaped, field) =>
    escaped ? escaped : `\${${field}}`,
  );
}

/**
 * Asks for the item's extra edits (the import of an auto-import) against the
 * document as it is before the completion lands, and returns a function that
 * applies them mapped to the document as it is then.
 */
function resolveEdits(view: EditorView, item: lsp.CompletionItem) {
  const plugin = LSPPlugin.get(view);
  if (!plugin) return null;
  const canResolve =
    plugin.client.serverCapabilities?.completionProvider?.resolveProvider &&
    item.data !== undefined;
  if (!item.additionalTextEdits && !canResolve) return null;
  plugin.client.sync();
  const start = plugin.syncedDoc;
  const mapping = plugin.client.workspaceMapping();
  const resolved = item.additionalTextEdits
    ? Promise.resolve(item)
    : plugin.client.request<lsp.CompletionItem, lsp.CompletionItem>(
        "completionItem/resolve",
        item,
      );
  return resolved
    .then(
      (full) => () => {
        const changes = (full.additionalTextEdits ?? []).map((edit) => ({
          from: mapping.mapPos(
            plugin.uri,
            plugin.fromPosition(edit.range.start, start),
          ),
          to: mapping.mapPos(
            plugin.uri,
            plugin.fromPosition(edit.range.end, start),
          ),
          insert: edit.newText,
        }));
        if (changes.length > 0) {
          view.dispatch({ changes, userEvent: "input.complete" });
        }
      },
      () => () => {},
    )
    .finally(() => mapping.destroy());
}

const resolvedItems = new WeakMap<
  lsp.CompletionItem,
  Promise<lsp.CompletionItem>
>();

async function completionInfo(plugin: LSPPlugin, item: lsp.CompletionItem) {
  let full = item;
  if (plugin.client.serverCapabilities?.completionProvider?.resolveProvider) {
    let resolving = resolvedItems.get(item);
    if (!resolving) {
      resolving = plugin.client
        .request<lsp.CompletionItem, lsp.CompletionItem>(
          "completionItem/resolve",
          item,
        )
        .catch(() => item);
      resolvedItems.set(item, resolving);
    }
    full = await resolving;
  }
  const markdown = infoMarkdown(full);
  return markdown ? renderHover(markdown) : null;
}

export function infoMarkdown(item: lsp.CompletionItem): string | null {
  const parts: string[] = [];
  if (item.detail) {
    parts.push(
      /^(?:Add|Update) import\b/.test(item.detail)
        ? item.detail
        : `\`\`\`typescript\n${item.detail}\n\`\`\``,
    );
  }
  const documentation = item.documentation;
  const docText =
    typeof documentation === "string" ? documentation : documentation?.value;
  if (docText?.trim()) parts.push(docText.trim());
  return parts.length > 0 ? parts.join("\n\n") : null;
}

const completionTheme = EditorView.theme({
  ".cm-tooltip.cm-completionInfo:has(.cm-lsp-hover)": {
    padding: "0",
    maxWidth: "min(480px, 60vw)",
  },
});
