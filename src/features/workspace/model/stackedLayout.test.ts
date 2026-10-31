import { describe, expect, it } from "vitest";
import { newFileTab, newTab, openEditorTab } from "./layout";
import { stackedPair, stackedSurface } from "./stackedLayout";

const file = (path: string) => newFileTab(path, "/p", false);
const ids = ["s1"];

describe("stackedLayout", () => {
  it("is not stackable with only a session", () => {
    const tab = newTab("s1");
    expect(stackedPair(tab.layout, ids, tab.editorPanes)).toBeNull();
  });

  it("pairs the session with the editor pane opened beside it", () => {
    let tab = newTab("s1");
    tab = openEditorTab(tab, file("/p/a.ts"));
    tab = openEditorTab(tab, file("/p/b.ts"), { pin: true });
    const stacked = stackedPair(tab.layout, ids, tab.editorPanes);
    expect(stacked?.sessionId).toBe("s1");
    expect(stacked?.paneId).toBe(tab.editorPanes[0].id);
  });

  it("falls back when the pane holds a terminal", () => {
    let tab = newTab("s1");
    tab = openEditorTab(tab, file("/p/a.ts"));
    const pane = {
      ...tab.editorPanes[0],
      files: [{ ...tab.editorPanes[0].files[0], terminal: true }],
    };
    expect(stackedPair(tab.layout, ids, [pane])).toBeNull();
  });

  it("follows focus: file on open, session once focused", () => {
    let tab = newTab("s1");
    tab = openEditorTab(tab, file("/p/a.ts"));
    const stacked = stackedPair(tab.layout, ids, tab.editorPanes)!;
    expect(stackedSurface(stacked, tab.focusedId)).toBe("file");
    expect(stackedSurface(stacked, "s1")).toBe("session");
  });
});
