import {
  LSPPlugin,
  Workspace,
  type WorkspaceFile,
} from "@codemirror/lsp-client";
import { ChangeSet, type Text } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

class SharedFile implements WorkspaceFile {
  views: EditorView[] = [];
  // Set when another view takes over, as its content may differ.
  replaced = false;

  constructor(
    readonly uri: string,
    readonly languageId: string,
    public version: number,
    public doc: Text,
  ) {}

  getView(main?: EditorView) {
    return main && this.views.includes(main) ? main : (this.views[0] ?? null);
  }
}

/** Like the default workspace, but a file may be open in several editors: the first one feeds the server. */
export class EditorWorkspace extends Workspace {
  files: SharedFile[] = [];

  syncFiles() {
    const updates = [];
    for (const file of this.files) {
      const [view, ...others] = file.views;
      const plugin = view && LSPPlugin.get(view);
      if (!plugin) continue;
      for (const other of others) LSPPlugin.get(other)?.clear();
      const changes = file.replaced
        ? ChangeSet.of(
            { from: 0, to: file.doc.length, insert: view.state.doc },
            file.doc.length,
          )
        : plugin.unsyncedChanges;
      if (changes.empty) continue;
      updates.push({ file, prevDoc: file.doc, changes });
      file.doc = view.state.doc;
      file.version += 1;
      file.replaced = false;
      plugin.clear();
    }
    return updates;
  }

  openFile(uri: string, languageId: string, view: EditorView) {
    const file = this.getFile(uri) as SharedFile | null;
    if (file) {
      file.views.push(view);
      return;
    }
    const opened = new SharedFile(uri, languageId, 0, view.state.doc);
    opened.views.push(view);
    this.files.push(opened);
    this.client.didOpen(opened);
  }

  closeFile(uri: string, view: EditorView) {
    const file = this.getFile(uri) as SharedFile | null;
    if (!file) return;
    const wasMain = file.views[0] === view;
    file.views = file.views.filter((other) => other !== view);
    if (file.views.length > 0) {
      if (wasMain) file.replaced = true;
      return;
    }
    this.files = this.files.filter((other) => other !== file);
    this.client.didClose(uri);
  }
}
