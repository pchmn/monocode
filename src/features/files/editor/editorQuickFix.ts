import { LSPPlugin } from "@codemirror/lsp-client";
import {
  Prec,
  StateEffect,
  StateField,
  type Extension,
} from "@codemirror/state";
import {
  EditorView,
  keymap,
  showTooltip,
  type Command,
  type Tooltip,
} from "@codemirror/view";
import type * as lsp from "vscode-languageserver-protocol";
import { showLspMessage } from "./editorGoToDefinition";
import { serverDiagnosticsAt } from "./editorLspDiagnostics";
import { lspErrorMessage, lspRequest } from "./lsp/languageServer";
import { applyWorkspaceEdit } from "./lsp/workspaceEdit";

type Action = lsp.CodeAction | lsp.Command;

type Menu = { pos: number; actions: Action[]; selected: number };

const setMenu = StateEffect.define<Menu | null>();

const menuField = StateField.define<Menu | null>({
  create: () => null,
  update(menu, tr) {
    for (const effect of tr.effects)
      if (effect.is(setMenu)) return effect.value;
    return tr.docChanged || tr.selection ? null : menu;
  },
  provide: (field) =>
    showTooltip.from(
      field,
      (menu): Tooltip | null =>
        menu && { pos: menu.pos, create: (view) => renderMenu(view, menu) },
    ),
});

/** Lists tsgo's fixes for the diagnostics at `from`–`to`, or on the caret's line. */
export async function openQuickFix(
  view: EditorView,
  from: number,
  to: number,
): Promise<void> {
  let response;
  try {
    response = await lspRequest<Action[] | null>(
      view,
      "textDocument/codeAction",
      (plugin) => {
        const { state } = plugin.view;
        let diagnostics = serverDiagnosticsAt(state, plugin, from, to);
        let range = {
          start: plugin.toPosition(from),
          end: plugin.toPosition(to),
        };
        if (diagnostics.length === 0 && from === to) {
          const line = state.doc.lineAt(from);
          diagnostics = serverDiagnosticsAt(state, plugin, line.from, line.to);
          range = diagnostics[0]?.range ?? range;
        }
        return {
          textDocument: { uri: plugin.uri },
          range,
          context: { diagnostics, triggerKind: 1 },
        };
      },
    );
  } catch (error) {
    showLspMessage(view, from, lspErrorMessage(error));
    return;
  }
  if (!response) return;
  const actions = (response.result ?? [])
    .filter((action) => !("disabled" in action && action.disabled))
    .sort((a, b) => Number(isPreferred(b)) - Number(isPreferred(a)));
  if (actions.length === 0) {
    showLspMessage(view, from, "No quick fixes available");
    return;
  }
  view.dispatch({
    effects: setMenu.of({
      pos: view.state.selection.main.head,
      actions,
      selected: 0,
    }),
  });
}

function isPreferred(action: Action) {
  return "isPreferred" in action && action.isPreferred === true;
}

export async function runCodeAction(plugin: LSPPlugin, action: Action) {
  const { client } = plugin;
  if (typeof action.command === "string") {
    await executeCommand(plugin, action as lsp.Command);
    return;
  }
  let codeAction = action as lsp.CodeAction;
  const provider = client.serverCapabilities?.codeActionProvider;
  const canResolve = typeof provider === "object" && provider.resolveProvider;
  if (!codeAction.edit && codeAction.data !== undefined && canResolve) {
    codeAction = await client.request<lsp.CodeAction, lsp.CodeAction>(
      "codeAction/resolve",
      codeAction,
    );
  }
  if (codeAction.edit) await applyWorkspaceEdit(client, codeAction.edit);
  if (codeAction.command) await executeCommand(plugin, codeAction.command);
}

function executeCommand(plugin: LSPPlugin, command: lsp.Command) {
  return plugin.client.request("workspace/executeCommand", {
    command: command.command,
    arguments: command.arguments,
  });
}

async function applyAction(view: EditorView, action: Action) {
  view.dispatch({ effects: setMenu.of(null) });
  const plugin = LSPPlugin.get(view);
  if (!plugin) return;
  try {
    await runCodeAction(plugin, action);
  } catch (error) {
    showLspMessage(
      view,
      view.state.selection.main.head,
      lspErrorMessage(error),
    );
  }
}

function renderMenu(view: EditorView, menu: Menu) {
  const dom = document.createElement("div");
  dom.className = "cm-lsp-quickfix";
  dom.setAttribute("role", "listbox");
  // Keeps the editor focused, so the menu's keys keep working.
  dom.addEventListener("mousedown", (event) => event.preventDefault());
  menu.actions.forEach((action, index) => {
    const item = document.createElement("div");
    item.className = "cm-lsp-quickfix-item";
    item.setAttribute("role", "option");
    if (index === menu.selected) item.setAttribute("aria-selected", "true");
    item.textContent = action.title;
    item.addEventListener("click", () => void applyAction(view, action));
    dom.append(item);
  });
  return { dom };
}

function moveSelection(by: number): Command {
  return (view) => {
    const menu = view.state.field(menuField, false);
    if (!menu) return false;
    const count = menu.actions.length;
    view.dispatch({
      effects: setMenu.of({
        ...menu,
        selected: (menu.selected + by + count) % count,
      }),
    });
    return true;
  };
}

const acceptSelected: Command = (view) => {
  const menu = view.state.field(menuField, false);
  const action = menu?.actions[menu.selected];
  if (!action) return false;
  void applyAction(view, action);
  return true;
};

const closeMenu: Command = (view) => {
  if (!view.state.field(menuField, false)) return false;
  view.dispatch({ effects: setMenu.of(null) });
  return true;
};

export const quickFixCommand: Command = (view) => {
  const { from, to } = view.state.selection.main;
  void openQuickFix(view, from, to);
  return true;
};

export const organizeImportsCommand: Command = (view) => {
  void (async () => {
    const pos = view.state.selection.main.head;
    try {
      const response = await lspRequest<Action[] | null>(
        view,
        "textDocument/codeAction",
        (plugin) => ({
          textDocument: { uri: plugin.uri },
          range: {
            start: plugin.toPosition(0),
            end: plugin.toPosition(plugin.view.state.doc.length),
          },
          context: {
            diagnostics: [],
            only: ["source.organizeImports"],
            triggerKind: 1,
          },
        }),
      );
      const action = response?.result?.find(
        (candidate) =>
          "kind" in candidate &&
          candidate.kind?.startsWith("source.organizeImports"),
      );
      if (response && action) await runCodeAction(response.plugin, action);
    } catch (error) {
      showLspMessage(view, pos, lspErrorMessage(error));
    }
  })();
  return true;
};

export const editorQuickFix: Extension = [
  menuField,
  Prec.highest(
    keymap.of([
      { key: "ArrowDown", run: moveSelection(1) },
      { key: "ArrowUp", run: moveSelection(-1) },
      { key: "Enter", run: acceptSelected },
      { key: "Tab", run: acceptSelected },
      { key: "Escape", run: closeMenu },
    ]),
  ),
  EditorView.domEventHandlers({
    blur: (_event, view) => {
      closeMenu(view);
    },
  }),
  EditorView.theme({
    ".cm-lsp-quickfix": {
      fontFamily: "var(--font-mono)",
      fontSize: "12px",
      padding: "2px 0",
      maxHeight: "240px",
      overflowY: "auto",
    },
    ".cm-lsp-quickfix-item": {
      padding: "2px 10px",
      cursor: "pointer",
      whiteSpace: "nowrap",
    },
    ".cm-lsp-quickfix-item[aria-selected]": {
      backgroundColor:
        "color-mix(in srgb, var(--color-accent) 25%, transparent)",
    },
  }),
];
