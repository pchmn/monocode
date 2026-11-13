// @vitest-environment happy-dom
import { LSPPlugin } from "@codemirror/lsp-client";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeTsgo } from "./fakeTsgo";
import { editorLanguageServer, lspRequest, uriToPath } from "./languageServer";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", async () => ({
  invoke,
  Channel: (await import("./fakeTsgo")).FakeChannel,
}));

const PATH = "/repo/src/main.ts";
const views: EditorView[] = [];

function editor(doc: string, path = PATH) {
  const view = new EditorView({
    parent: document.body,
    state: EditorState.create({ doc, extensions: editorLanguageServer(path) }),
  });
  views.push(view);
  return view;
}

async function attached(view: EditorView) {
  await vi.waitFor(() => expect(LSPPlugin.get(view)).not.toBeNull());
}

function hover(view: EditorView) {
  return lspRequest(view, "textDocument/hover", (plugin) => ({
    textDocument: { uri: plugin.uri },
    position: plugin.toPosition(0),
  }));
}

function type(view: EditorView, at: number, text: string) {
  view.dispatch({ changes: { from: at, insert: text } });
}

afterEach(() => {
  for (const view of views.splice(0)) view.destroy();
  invoke.mockReset();
  vi.useRealTimers();
});

describe("language server sync", () => {
  it("starts the server on the first request, then opens the file", async () => {
    const server = fakeTsgo(invoke);
    const view = editor("const a = 1;");
    await attached(view);
    expect(invoke).not.toHaveBeenCalledWith("lsp_connect", expect.anything());

    await hover(view);
    expect(server.methods()).toEqual([
      "initialize",
      "initialized",
      "textDocument/didOpen",
      "textDocument/hover",
    ]);
    expect(server.sent[2].params.textDocument).toMatchObject({
      uri: `file://${PATH}`,
      text: "const a = 1;",
    });
  });

  it("sends one batched incremental change after typing pauses", async () => {
    const server = fakeTsgo(invoke);
    const doc = "x".repeat(2000);
    const view = editor(doc);
    await attached(view);
    await hover(view);
    vi.useFakeTimers();

    type(view, 0, "a");
    type(view, 1, "b");
    expect(server.methods()).not.toContain("textDocument/didChange");
    await vi.advanceTimersByTimeAsync(300);

    const changes = server.sent.filter(
      (message) => message.method === "textDocument/didChange",
    );
    expect(changes).toHaveLength(1);
    expect(changes[0].params.contentChanges).toEqual([
      {
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 },
        },
        text: "ab",
      },
    ]);
  });

  it("closes the file with its last editor", async () => {
    const server = fakeTsgo(invoke);
    const first = editor("a");
    const second = editor("a");
    await attached(first);
    await attached(second);
    await hover(first);

    first.destroy();
    type(second, 1, "b");
    await hover(second);
    expect(server.methods()).not.toContain("textDocument/didClose");
    expect(server.sent.at(-2)?.params.contentChanges).toEqual([{ text: "ab" }]);

    second.destroy();
    await vi.waitFor(() =>
      expect(server.methods().at(-1)).toBe("textDocument/didClose"),
    );
  });

  it("restarts an exited server and reopens its files", async () => {
    const server = fakeTsgo(invoke);
    const view = editor("a");
    await attached(view);
    await hover(view);

    server.exit();
    type(view, 1, "b");
    await hover(view);

    expect(server.methods().slice(4)).toEqual([
      "initialize",
      "initialized",
      "textDocument/didOpen",
      "textDocument/didChange",
      "textDocument/hover",
    ]);
    expect(server.sent[7].params.contentChanges).toEqual([{ text: "ab" }]);
  });

  it("ignores files no server handles", async () => {
    const view = editor("fn main() {}", "/repo/main.rs");
    expect(await hover(view)).toBeUndefined();
    expect(invoke).not.toHaveBeenCalledWith("lsp_document", expect.anything());
  });

  it("turns file URIs back into paths", () => {
    expect(uriToPath("file:///repo/a%20b.ts")).toBe("/repo/a b.ts");
    expect(uriToPath("file:///C:/repo/a.ts")).toBe("C:/repo/a.ts");
    expect(uriToPath("untitled:1")).toBeNull();
  });
});
