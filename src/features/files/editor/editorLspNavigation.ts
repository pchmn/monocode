import type { Extension } from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";
import { goToLocation } from "./editorGoToDefinition";
import { supportsLanguageServer } from "./lsp/languageServer";
import { rebindableKeymap, type EditorKey } from "./editorVscodeKeys";

export const LSP_NAVIGATION_EVENT = "monocode:lsp-navigation";

export type LspNavigationRequest =
  | {
      kind: "documentSymbols" | "workspaceSymbols";
      source: ScriptEditor | null;
    }
  | { kind: "references"; source: ScriptEditor; pos: number };

export type ScriptEditor = { view: EditorView; path: string };

let lastScriptEditor: ScriptEditor | null = null;

/** The focused script editor, or the last one focused while it stays open. */
export function currentScriptEditor(): ScriptEditor | null {
  return lastScriptEditor;
}

export function requestLspNavigation(request: LspNavigationRequest) {
  window.dispatchEvent(
    new CustomEvent<LspNavigationRequest>(LSP_NAVIGATION_EVENT, {
      detail: request,
    }),
  );
}

export function editorLspNavigation(path: string): Extension {
  if (!supportsLanguageServer(path)) return [];
  const caret = (view: EditorView) => view.state.selection.main.head;
  const keys: EditorKey[] = [
    {
      command: "Editor: Go to Definition",
      key: "F12",
      run: (view) => {
        void goToLocation(view, path, caret(view), "textDocument/definition");
        return true;
      },
    },
    {
      command: "Editor: Go to Implementation",
      key: "Mod-F12",
      run: (view) => {
        void goToLocation(
          view,
          path,
          caret(view),
          "textDocument/implementation",
        );
        return true;
      },
    },
    {
      command: "Editor: Go to Type Definition",
      key: "Shift-Mod-F12",
      run: (view) => {
        void goToLocation(
          view,
          path,
          caret(view),
          "textDocument/typeDefinition",
        );
        return true;
      },
    },
    {
      command: "Editor: Find All References",
      key: "Shift-F12",
      run: (view) => {
        requestLspNavigation({
          kind: "references",
          source: { view, path },
          pos: caret(view),
        });
        return true;
      },
    },
    {
      command: "Editor: Go to Symbol in File",
      key: "Shift-Mod-o",
      run: (view) => {
        requestLspNavigation({
          kind: "documentSymbols",
          source: { view, path },
        });
        return true;
      },
    },
  ];
  return [
    rebindableKeymap(keys),
    ViewPlugin.define((view) => {
      if (view.hasFocus) lastScriptEditor = { view, path };
      return {
        destroy() {
          if (lastScriptEditor?.view === view) lastScriptEditor = null;
        },
      };
    }),
    EditorView.domEventHandlers({
      focus(_event, view) {
        lastScriptEditor = { view, path };
      },
    }),
  ];
}
