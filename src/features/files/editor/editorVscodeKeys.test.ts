// @vitest-environment happy-dom
import { javascript } from "@codemirror/lang-javascript";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView, runScopeHandlers } from "@codemirror/view";
import { minimalSetup } from "codemirror";
import { afterEach, describe, expect, it } from "vitest";
import { saveKeybindingOverride } from "../../settings/model/settings";
import { editorVscodeKeys } from "./editorVscodeKeys";

let view: EditorView;

function editor(doc: string, anchor: number, head = anchor) {
  view = new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc,
      selection: EditorSelection.single(anchor, head),
      extensions: [minimalSetup, javascript(), editorVscodeKeys],
    }),
  });
  return view;
}

function press(key: string, init: KeyboardEventInit = {}) {
  const keyCode = key.length === 1 ? key.toUpperCase().charCodeAt(0) : 13;
  const event = new KeyboardEvent("keydown", { key, ...init });
  Object.defineProperty(event, "keyCode", { value: keyCode });
  return runScopeHandlers(view, event, "editor");
}

const mod = /Mac/.test(navigator.platform)
  ? { metaKey: true }
  : { ctrlKey: true };

afterEach(() => {
  view?.destroy();
  localStorage.clear();
});

describe("VS Code editor keys", () => {
  it("toggles a line comment with Mod-/", () => {
    editor("const a = 1;", 0);
    expect(press("/", mod)).toBe(true);
    expect(view.state.doc.toString()).toBe("// const a = 1;");
  });

  it("adds the next occurrence with Mod-d", () => {
    editor("foo bar foo", 0, 3);
    expect(press("d", mod)).toBe(true);
    expect(view.state.selection.ranges.map((r) => [r.from, r.to])).toEqual([
      [0, 3],
      [8, 11],
    ]);
  });

  it("selects every occurrence with Shift-Mod-l", () => {
    editor("foo foo foo", 0, 3);
    expect(press("L", { ...mod, shiftKey: true })).toBe(true);
    expect(view.state.selection.ranges).toHaveLength(3);
  });

  it("inserts an indented line above with Shift-Mod-Enter", () => {
    editor("a\n  b", 4);
    expect(press("Enter", { ...mod, shiftKey: true })).toBe(true);
    expect(view.state.doc.toString()).toBe("a\n  \n  b");
    expect(view.state.selection.main.head).toBe(4);
  });

  it("runs a command on its rebound shortcut and silences the default", () => {
    saveKeybindingOverride("Editor: Toggle Line Comment", {
      shortcut: "Control+Shift+KeyC",
    });
    editor("const a = 1;", 0);
    expect(press("/", mod)).toBe(true);
    expect(view.state.doc.toString()).toBe("const a = 1;");

    view.contentDOM.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "C",
        code: "KeyC",
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(view.state.doc.toString()).toBe("// const a = 1;");
  });

  it("does nothing on the default chord of a disabled command", () => {
    saveKeybindingOverride("Editor: Move Line Down", { disabled: true });
    editor("a\nb", 0);
    press("ArrowDown", { altKey: true });
    expect(view.state.doc.toString()).toBe("a\nb");
  });
});
