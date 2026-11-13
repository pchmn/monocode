// @vitest-environment happy-dom
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView, runScopeHandlers } from "@codemirror/view";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  editorGoToDefinition,
  OPEN_DEFINITION_EVENT,
  supportsGoToDefinition,
} from "./editorGoToDefinition";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", async (original) => ({
  ...(await original<typeof import("@tauri-apps/api/core")>()),
  invoke,
}));

const PATH = "/repo/src/main.ts";
let view: EditorView;

function editor(doc: string, cursor: number) {
  view = new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc,
      selection: EditorSelection.cursor(cursor),
      extensions: editorGoToDefinition(PATH),
    }),
  });
}

function pressF12() {
  const event = new KeyboardEvent("keydown", { key: "F12" });
  Object.defineProperty(event, "keyCode", { value: 123 });
  return runScopeHandlers(view, event, "editor");
}

afterEach(() => {
  view?.destroy();
  invoke.mockReset();
});

describe("go to definition", () => {
  it("only applies to script files", () => {
    expect(supportsGoToDefinition("a.tsx")).toBe(true);
    expect(supportsGoToDefinition("a.mjs")).toBe(true);
    expect(supportsGoToDefinition("a.rs")).toBe(false);
  });

  it("asks for the definition at the caret and opens another file", async () => {
    invoke.mockResolvedValue([
      { path: "/repo/src/lib/greet.ts", line: 0, character: 16 },
    ]);
    const opened = vi.fn();
    window.addEventListener(OPEN_DEFINITION_EVENT, opened);
    editor('import { greet } from "./lib";\n\ngreet("x");', 33);

    expect(pressF12()).toBe(true);
    await vi.waitFor(() => expect(opened).toHaveBeenCalled());
    window.removeEventListener(OPEN_DEFINITION_EVENT, opened);

    expect(invoke).toHaveBeenCalledWith("lsp_definition", {
      request: expect.objectContaining({ path: PATH, line: 2, character: 1 }),
    });
    expect((opened.mock.calls[0][0] as CustomEvent).detail).toEqual({
      path: "/repo/src/lib/greet.ts",
      line: 1,
      column: 17,
    });
  });

  it("moves the caret for a definition in the same file", async () => {
    invoke.mockResolvedValue([{ path: PATH, line: 0, character: 9 }]);
    editor("function greet() {}\ngreet();", 21);

    pressF12();
    await vi.waitFor(() => expect(view.state.selection.main.head).toBe(9));
  });

  it("shows the error where the definition was asked", async () => {
    invoke.mockRejectedValue("tsgo not found");
    editor("greet();", 1);

    pressF12();
    await vi.waitFor(() =>
      expect(
        document.querySelector(".cm-definition-message")?.textContent,
      ).toBe("tsgo not found"),
    );
  });

  it("closes the document in tsgo only once it was synced", async () => {
    editor("greet();", 1);
    view.destroy();
    expect(invoke).not.toHaveBeenCalled();

    invoke.mockResolvedValue([]);
    editor("greet();", 1);
    pressF12();
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    view.destroy();
    expect(invoke).toHaveBeenLastCalledWith("lsp_close_document", {
      path: PATH,
    });
  });
});
