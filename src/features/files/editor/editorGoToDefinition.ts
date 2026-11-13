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
  ViewPlugin,
  type DecorationSet,
  type Tooltip,
} from "@codemirror/view";
import { invoke } from "@tauri-apps/api/core";
import { IS_MAC } from "../../../platform/tauri/platform";
import type { EditorNavigation } from "../../search/model/search";

export const OPEN_DEFINITION_EVENT = "monocode:open-definition";

export type OpenDefinitionDetail = EditorNavigation & { path: string };

/** 0-based, as the LSP commands return it. */
export type LspLocation = { path: string; line: number; character: number };

const SCRIPT_FILE = /\.(?:[cm]?[jt]s|[jt]sx)$/i;
const MESSAGE_MS = 4000;

export function supportsGoToDefinition(path: string): boolean {
  return SCRIPT_FILE.test(path);
}

export function editorGoToDefinition(path: string): Extension {
  if (!supportsGoToDefinition(path)) return [];
  return [
    linkField,
    messageField,
    documentTracker(path),
    EditorView.domEventHandlers({
      mousedown(event, view) {
        if (event.button !== 0 || !isLinkModifier(event)) return false;
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos == null) return false;
        event.preventDefault();
        void goToLocation(view, path, pos, "lsp_definition");
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

const syncedViews = new WeakSet<EditorView>();

export function markLspSynced(view: EditorView) {
  syncedViews.add(view);
}

// Lets tsgo drop a closed file's project instead of holding it until it stops.
function documentTracker(path: string) {
  return ViewPlugin.define((view) => ({
    destroy() {
      if (!syncedViews.has(view)) return;
      void invoke("lsp_close_document", { path }).catch(() => {});
    },
  }));
}

export function positionRequest(view: EditorView, path: string, pos: number) {
  const line = view.state.doc.lineAt(pos);
  markLspSynced(view);
  return {
    path,
    text: view.state.doc.toString(),
    line: line.number - 1,
    character: pos - line.from,
  };
}

const NOT_FOUND: Record<string, string> = {
  lsp_definition: "No definition found",
  lsp_implementation: "No implementation found",
  lsp_type_definition: "No type definition found",
};

export async function goToLocation(
  view: EditorView,
  path: string,
  pos: number,
  command: "lsp_definition" | "lsp_implementation" | "lsp_type_definition",
) {
  let locations: LspLocation[];
  try {
    locations = await invoke<LspLocation[]>(command, {
      request: positionRequest(view, path, pos),
    });
  } catch (error) {
    showLspMessage(view, pos, String(error));
    return;
  }
  const target = locations[0];
  if (!target) {
    showLspMessage(view, pos, NOT_FOUND[command]);
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
