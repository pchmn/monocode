// @vitest-environment happy-dom
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView, runScopeHandlers } from "@codemirror/view";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  editorGoToDefinition,
  lspLocations,
  OPEN_DEFINITION_EVENT,
} from "./editorGoToDefinition";
import {
  LSP_NAVIGATION_EVENT,
  editorLspNavigation,
} from "./editorLspNavigation";
import { fakeTsgo } from "./lsp/fakeTsgo";
import { editorLanguageServer } from "./lsp/languageServer";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", async () => ({
  invoke,
  Channel: (await import("./lsp/fakeTsgo")).FakeChannel,
}));

const PATH = "/repo/src/main.ts";
let view: EditorView;

function editor(doc: string, cursor: number) {
  view = new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc,
      selection: EditorSelection.cursor(cursor),
      extensions: [
        editorLanguageServer(PATH),
        editorGoToDefinition(PATH),
        editorLspNavigation(PATH),
      ],
    }),
  });
}

function press(init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", { key: "F12", ...init });
  Object.defineProperty(event, "keyCode", { value: 123 });
  return runScopeHandlers(view, event, "editor");
}

const pressF12 = () => press();
const MOD = /Mac/.test(navigator.platform)
  ? { metaKey: true }
  : { ctrlKey: true };

afterEach(() => {
  view?.destroy();
  invoke.mockReset();
});

describe("go to definition", () => {
  it("reads locations and location links", () => {
    expect(
      lspLocations([
        {
          uri: "file:///a.ts",
          range: { start: { line: 7, character: 13 } },
        },
        {
          targetUri: "file:///b.ts",
          targetRange: { start: { line: 1, character: 0 } },
          targetSelectionRange: { start: { line: 2, character: 4 } },
        },
      ]),
    ).toEqual([
      { path: "/a.ts", line: 7, character: 13 },
      { path: "/b.ts", line: 2, character: 4 },
    ]);
    expect(lspLocations(null)).toEqual([]);
  });

  it("asks for the definition at the caret and opens another file", async () => {
    const server = fakeTsgo(invoke, () => [
      {
        uri: "file:///repo/src/lib/greet.ts",
        range: { start: { line: 0, character: 16 } },
      },
    ]);
    const opened = vi.fn();
    window.addEventListener(OPEN_DEFINITION_EVENT, opened);
    editor('import { greet } from "./lib";\n\ngreet("x");', 33);

    expect(pressF12()).toBe(true);
    await vi.waitFor(() => expect(opened).toHaveBeenCalled());
    window.removeEventListener(OPEN_DEFINITION_EVENT, opened);

    expect(server.sent.at(-1)).toMatchObject({
      method: "textDocument/definition",
      params: {
        textDocument: { uri: `file://${PATH}` },
        position: { line: 2, character: 1 },
      },
    });
    expect((opened.mock.calls[0][0] as CustomEvent).detail).toEqual({
      path: "/repo/src/lib/greet.ts",
      line: 1,
      column: 17,
    });
  });

  it("moves the caret for a definition in the same file", async () => {
    fakeTsgo(invoke, () => ({
      uri: `file://${PATH}`,
      range: { start: { line: 0, character: 9 } },
    }));
    editor("function greet() {}\ngreet();", 21);

    pressF12();
    await vi.waitFor(() => expect(view.state.selection.main.head).toBe(9));
  });

  it("shows the error where the definition was asked", async () => {
    fakeTsgo(invoke);
    const answer = invoke.getMockImplementation()!;
    invoke.mockImplementation((command: string, args: unknown) =>
      command === "lsp_connect"
        ? Promise.reject("tsgo not found")
        : answer(command, args),
    );
    editor("greet();", 1);

    pressF12();
    await vi.waitFor(() =>
      expect(
        document.querySelector(".cm-definition-message")?.textContent,
      ).toBe("tsgo not found"),
    );
  });

  it("goes to the implementation and type definition with their own command", async () => {
    const server = fakeTsgo(invoke, () => ({
      uri: `file://${PATH}`,
      range: { start: { line: 0, character: 6 } },
    }));
    editor("class Greeter {}\nnew Greeter();", 22);

    press(MOD);
    await vi.waitFor(() =>
      expect(server.methods()).toContain("textDocument/implementation"),
    );
    press({ ...MOD, shiftKey: true });
    await vi.waitFor(() =>
      expect(server.methods()).toContain("textDocument/typeDefinition"),
    );
  });

  it("says when there is no implementation", async () => {
    fakeTsgo(invoke, () => []);
    editor("greet();", 1);

    press(MOD);
    await vi.waitFor(() =>
      expect(
        document.querySelector(".cm-definition-message")?.textContent,
      ).toBe("No implementation found"),
    );
  });

  it("asks the app for the references at the caret", () => {
    fakeTsgo(invoke);
    const requested = vi.fn();
    window.addEventListener(LSP_NAVIGATION_EVENT, requested);
    editor("greet();", 2);

    expect(press({ shiftKey: true })).toBe(true);
    window.removeEventListener(LSP_NAVIGATION_EVENT, requested);
    const detail = (requested.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toMatchObject({ kind: "references", pos: 2 });
    expect(detail.source.path).toBe(PATH);
  });
});
