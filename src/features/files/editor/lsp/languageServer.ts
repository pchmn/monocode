import { LSPClient, LSPPlugin } from "@codemirror/lsp-client";
import { Compartment, type Extension } from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";
import { invoke } from "@tauri-apps/api/core";
import { EditorWorkspace } from "./editorWorkspace";
import { TauriTransport } from "./tauriTransport";

type LspDocument = {
  root: string;
  rootUri: string;
  uri: string;
  languageId: string;
};

// The first request on a large monorepo waits for its project to load.
const REQUEST_TIMEOUT_MS = 30_000;
const SYNC_DELAY_MS = 250;
// Beyond the client's defaults, for go to definition and the symbol pickers.
const CAPABILITIES = {
  textDocument: {
    definition: { linkSupport: true },
    implementation: { linkSupport: true },
    typeDefinition: { linkSupport: true },
    documentSymbol: { hierarchicalDocumentSymbolSupport: true },
  },
  workspace: { symbol: {} },
};
const SCRIPT_FILE = /\.(?:[cm]?[jt]s|[jt]sx)$/i;

export function supportsLanguageServer(path: string): boolean {
  return SCRIPT_FILE.test(path);
}

class ServerConnection {
  readonly client: LSPClient;
  private transport: TauriTransport | null = null;
  private starting: Promise<void> | null = null;

  constructor(
    readonly root: string,
    rootUri: string,
  ) {
    this.client = new LSPClient({
      rootUri,
      timeout: REQUEST_TIMEOUT_MS,
      workspace: (client) => new EditorWorkspace(client),
      extensions: [{ clientCapabilities: CAPABILITIES }],
    });
  }

  ready(path: string): Promise<void> {
    if (this.transport && !this.transport.closed) {
      return this.client.initializing.then(() => {});
    }
    this.starting ??= this.start(path).finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  // Reconnecting re-sends `initialize`, then `didOpen` for every open file.
  private async start(path: string) {
    const transport = new TauriTransport(this.root);
    await invoke("lsp_connect", {
      root: this.root,
      path,
      channel: transport.channel,
    });
    if (this.transport) this.client.disconnect();
    this.transport = transport;
    this.client.connect(transport);
    try {
      await this.client.initializing;
    } catch (error) {
      transport.close();
      throw error;
    }
  }
}

const connections = new Map<string, ServerConnection>();

function connectionFor(document: LspDocument): ServerConnection {
  let connection = connections.get(document.root);
  if (!connection) {
    connection = new ServerConnection(document.root, document.rootUri);
    connections.set(document.root, connection);
  }
  return connection;
}

type Session = { connection: ServerConnection; path: string };

const sessions = new WeakMap<EditorView, Promise<Session | null>>();

/**
 * Keeps the server's copy of the file in step with every edit. The server
 * itself starts on the first request.
 */
export function editorLanguageServer(path: string): Extension {
  if (!supportsLanguageServer(path)) return [];
  const slot = new Compartment();
  return [
    slot.of([]),
    ViewPlugin.define((view) => {
      let destroyed = false;
      sessions.set(
        view,
        invoke<LspDocument | null>("lsp_document", { path }).then(
          (document) => {
            if (destroyed || !document) return null;
            const connection = connectionFor(document);
            view.dispatch({
              effects: slot.reconfigure([
                connection.client.plugin(document.uri, document.languageId),
                debouncedSync,
              ]),
            });
            return { connection, path };
          },
          () => null,
        ),
      );
      return {
        destroy() {
          destroyed = true;
        },
      };
    }),
  ];
}

const debouncedSync = ViewPlugin.define((view) => {
  let timer: number | undefined;
  return {
    update(update) {
      if (!update.docChanged) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(
        () => LSPPlugin.get(view)?.client.sync(),
        SYNC_DELAY_MS,
      );
    },
    destroy() {
      window.clearTimeout(timer);
    },
  };
});

/**
 * Sends a request about this editor's file, starting the server if needed.
 * Resolves to `undefined` when no server handles the file.
 */
export async function lspRequest<Result>(
  view: EditorView,
  method: string,
  params: (plugin: LSPPlugin) => unknown,
): Promise<{ result: Result; plugin: LSPPlugin; root: string } | undefined> {
  const session = await sessions.get(view);
  if (!session) return undefined;
  await session.connection.ready(session.path);
  const plugin = LSPPlugin.get(view);
  if (!plugin) return undefined;
  plugin.client.sync();
  const result = await plugin.client.request<unknown, Result>(
    method,
    params(plugin),
  );
  return { result, plugin, root: session.connection.root };
}

export function lspErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return String(error);
}

export function uriToPath(uri: string): string | null {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return null;
  }
  if (url.protocol !== "file:") return null;
  const path = decodeURIComponent(url.pathname);
  return /^\/[A-Za-z]:/.test(path) ? path.slice(1) : path;
}
