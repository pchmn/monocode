// @vitest-environment happy-dom
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView, runScopeHandlers } from "@codemirror/view";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  editorGoToDefinition,
  OPEN_DEFINITION_EVENT,
  supportsGoToDefinition,
} from "./editorGoToDefinition";
import {
  LSP_NAVIGATION_EVENT,
  editorLspNavigation,
} from "./editorLspNavigation";

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
      extensions: [editorGoToDefinition(PATH), editorLspNavigation(PATH)],
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

  it("goes to the implementation and type definition with their own command", async () => {
    invoke.mockResolvedValue([{ path: PATH, line: 0, character: 6 }]);
    editor("class Greeter {}\nnew Greeter();", 22);

    press(MOD);
    await vi.waitFor(() =>
      expect(invoke).toHaveBeenCalledWith(
        "lsp_implementation",
        expect.anything(),
      ),
    );
    press({ ...MOD, shiftKey: true });
    await vi.waitFor(() =>
      expect(invoke).toHaveBeenCalledWith(
        "lsp_type_definition",
        expect.anything(),
      ),
    );
  });

  it("says when there is no implementation", async () => {
    invoke.mockResolvedValue([]);
    editor("greet();", 1);

    press(MOD);
    await vi.waitFor(() =>
      expect(
        document.querySelector(".cm-definition-message")?.textContent,
      ).toBe("No implementation found"),
    );
  });

  it("asks the app for the references at the caret", () => {
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
