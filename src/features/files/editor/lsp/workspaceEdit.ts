import { LSPPlugin, type LSPClient } from "@codemirror/lsp-client";
import type { ChangeSpec, Text } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type * as lsp from "vscode-languageserver-protocol";
import { readTextFile, writeTextFile } from "../../../../platform/tauri/fs";
import { uriToPath } from "./languageServer";

/** Applies an edit from the server: open files in their editor, others on disk. */
export async function applyWorkspaceEdit(
  client: LSPClient,
  edit: lsp.WorkspaceEdit,
): Promise<void> {
  for (const [uri, edits] of editsByUri(edit)) {
    const view = client.workspace.getFile(uri)?.getView();
    const plugin = view && LSPPlugin.get(view);
    if (view && plugin) {
      applyToView(view, plugin, edits);
      continue;
    }
    const path = uriToPath(uri);
    if (!path) continue;
    await writeTextFile(path, applyTextEdits(await readTextFile(path), edits));
  }
}

export function editsByUri(
  edit: lsp.WorkspaceEdit,
): Map<string, lsp.TextEdit[]> {
  const byUri = new Map<string, lsp.TextEdit[]>();
  const add = (uri: string, edits: lsp.TextEdit[]) =>
    byUri.set(uri, [...(byUri.get(uri) ?? []), ...edits]);
  for (const [uri, edits] of Object.entries(edit.changes ?? {}))
    add(uri, edits);
  for (const change of edit.documentChanges ?? []) {
    // File creations, renames and deletions are not supported.
    if (!("textDocument" in change)) continue;
    add(
      change.textDocument.uri,
      change.edits.filter((edit): edit is lsp.TextEdit => "newText" in edit),
    );
  }
  return byUri;
}

// Server positions refer to the last document synced to it.
export function textEditChanges(
  plugin: LSPPlugin,
  edits: readonly lsp.TextEdit[],
): ChangeSpec[] {
  const synced: Text = plugin.syncedDoc;
  return edits.map((edit) => ({
    from: plugin.unsyncedChanges.mapPos(
      plugin.fromPosition(edit.range.start, synced),
    ),
    to: plugin.unsyncedChanges.mapPos(
      plugin.fromPosition(edit.range.end, synced),
    ),
    insert: edit.newText,
  }));
}

function applyToView(
  view: EditorView,
  plugin: LSPPlugin,
  edits: lsp.TextEdit[],
) {
  view.dispatch({
    changes: textEditChanges(plugin, edits),
    userEvent: "input.lsp",
  });
}

export function applyTextEdits(
  text: string,
  edits: readonly lsp.TextEdit[],
): string {
  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") lineStarts.push(i + 1);
  }
  const offset = ({ line, character }: lsp.Position) => {
    const start = lineStarts[line];
    if (start === undefined) return text.length;
    const end = lineStarts[line + 1] ?? text.length + 1;
    return Math.min(start + character, end - 1);
  };
  const ordered = edits
    .map((edit) => ({
      from: offset(edit.range.start),
      to: offset(edit.range.end),
      text: edit.newText,
    }))
    .sort((a, b) => b.from - a.from || b.to - a.to);
  let result = text;
  for (const { from, to, text: insert } of ordered) {
    result = result.slice(0, from) + insert + result.slice(to);
  }
  return result;
}
