import {
  EditorSelection,
  StateEffect,
  StateField,
  type Extension,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  showTooltip,
  type DecorationSet,
  type Tooltip,
} from "@codemirror/view";
import { IS_MAC } from "../../../platform/tauri/platform";
import type { EditorNavigation } from "../../search/model/search";
import {
  lspErrorMessage,
  lspRequest,
  supportsLanguageServer,
  uriToPath,
} from "./lsp/languageServer";

export const OPEN_DEFINITION_EVENT = "monocode:open-definition";

export type OpenDefinitionDetail = EditorNavigation & { path: string };

/** 0-based, as LSP counts. */
export type LspLocation = { path: string; line: number; character: number };

type Position = { line: number; character: number };

const MESSAGE_MS = 4000;

export function editorGoToDefinition(path: string): Extension {
  if (!supportsLanguageServer(path)) return [];
  return [
    linkField,
    messageField,
    EditorView.domEventHandlers({
      mousedown(event, view) {
        if (event.button !== 0 || !isLinkModifier(event)) return false;
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos == null) return false;
        event.preventDefault();
        void goToLocation(view, path, pos, "textDocument/definition");
        return true;
      },
      mousemove(event, view) {
        setLink(view, isLinkModifier(event) ? wordAt(view, event) : null);
      },
      mouseleave(_event, view) {
        setLink(view, null);
      },
      keyup(event, view) {
        if (!isLinkModifier(event)) setLink(view, null);
      },
    }),
  ];
}

function isLinkModifier(event: MouseEvent | KeyboardEvent): boolean {
  const mod = IS_MAC ? event.metaKey : event.ctrlKey;
  return mod && !event.altKey && !event.shiftKey;
}

// Location has `uri`/`range`; LocationLink has `targetUri`/`targetSelectionRange`.
export function lspLocations(result: unknown): LspLocation[] {
  const items: unknown[] = Array.isArray(result)
    ? result
    : result
      ? [result]
      : [];
  return items.flatMap((item) => {
    const link = item as {
      uri?: string;
      targetUri?: string;
      range?: { start: Position };
      targetSelectionRange?: { start: Position };
    } | null;
    const uri = link?.uri ?? link?.targetUri;
    const path = typeof uri === "string" ? uriToPath(uri) : null;
    const start = (link?.targetSelectionRange ?? link?.range)?.start;
    return path && start
      ? [{ path, line: start.line, character: start.character }]
      : [];
  });
}

export type LocationMethod =
  | "textDocument/definition"
  | "textDocument/implementation"
  | "textDocument/typeDefinition";

const NOT_FOUND: Record<LocationMethod, string> = {
  "textDocument/definition": "No definition found",
  "textDocument/implementation": "No implementation found",
  "textDocument/typeDefinition": "No type definition found",
};

export async function goToLocation(
  view: EditorView,
  path: string,
  pos: number,
  method: LocationMethod,
) {
  let response;
  try {
    response = await lspRequest<unknown>(view, method, (plugin) => ({
      textDocument: { uri: plugin.uri },
      position: plugin.toPosition(pos),
    }));
  } catch (error) {
    showLspMessage(view, pos, lspErrorMessage(error));
    return;
  }
  if (!response) return;
  const target = lspLocations(response.result)[0];
  if (!target) {
    showLspMessage(view, pos, NOT_FOUND[method]);
    return;
  }
  setLink(view, null);
  openLocation(view, path, target);
}

/** Moves `view` when `target` is its own file, else opens the file there. */
export function openLocation(
  view: EditorView | null,
  path: string | null,
  target: LspLocation,
) {
  if (view && target.path === path) {
    revealInView(view, target);
    return;
  }
  window.dispatchEvent(
    new CustomEvent<OpenDefinitionDetail>(OPEN_DEFINITION_EVENT, {
      detail: {
        path: target.path,
        line: target.line + 1,
        column: target.character + 1,
      },
    }),
  );
}

function revealInView(view: EditorView, target: LspLocation) {
  const doc = view.state.doc;
  const line = doc.line(Math.min(target.line + 1, doc.lines));
  const head = Math.min(line.from + target.character, line.to);
  view.dispatch({
    selection: EditorSelection.cursor(head),
    effects: EditorView.scrollIntoView(head, { y: "center" }),
  });
  view.focus();
}

function wordAt(view: EditorView, event: MouseEvent) {
  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
  if (pos == null) return null;
  const word = view.state.wordAt(pos);
  return word ? { from: word.from, to: word.to } : null;
}

type Range = { from: number; to: number };

const setLinkEffect = StateEffect.define<Range | null>();
const linkMark = Decoration.mark({ class: "cm-definition-link" });

function setLink(view: EditorView, range: Range | null) {
  const current = view.state.field(linkField).iter();
  const same = range
    ? current.value != null &&
      current.from === range.from &&
      current.to === range.to
    : current.value == null;
  if (!same) view.dispatch({ effects: setLinkEffect.of(range) });
}

const linkField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setLinkEffect)) {
        const range = effect.value;
        return range
          ? Decoration.set(linkMark.range(range.from, range.to))
          : Decoration.none;
      }
    }
    return transaction.docChanged ? Decoration.none : value;
  },
  provide: (field) => [
    EditorView.decorations.from(field),
    EditorView.theme({
      ".cm-definition-link": { textDecoration: "underline", cursor: "pointer" },
    }),
  ],
});

const setMessageEffect = StateEffect.define<Tooltip | null>();

export function showLspMessage(view: EditorView, pos: number, text: string) {
  view.dispatch({
    effects: setMessageEffect.of({
      pos,
      above: true,
      create: () => {
        const dom = document.createElement("div");
        dom.className = "cm-definition-message";
        dom.textContent = text;
        return { dom };
      },
    }),
  });
  window.setTimeout(() => {
    if (view.state.field(messageField, false)?.pos === pos) {
      view.dispatch({ effects: setMessageEffect.of(null) });
    }
  }, MESSAGE_MS);
}

const messageField = StateField.define<Tooltip | null>({
  create: () => null,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setMessageEffect)) return effect.value;
    }
    return transaction.docChanged || transaction.selection ? null : value;
  },
  provide: (field) => [
    showTooltip.from(field),
    EditorView.theme({
      ".cm-definition-message": { padding: "2px 6px", fontSize: "12px" },
    }),
  ],
});
