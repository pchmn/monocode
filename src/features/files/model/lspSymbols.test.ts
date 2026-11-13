// @vitest-environment happy-dom
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, it, vi } from "vitest";
import { fakeTsgo } from "../editor/lsp/fakeTsgo";
import { editorLanguageServer } from "../editor/lsp/languageServer";
import {
  findReferences,
  parseSymbols,
  rankSymbols,
  symbolBadge,
  type LspSymbol,
} from "./lspSymbols";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", async () => ({
  invoke,
  Channel: (await import("../editor/lsp/fakeTsgo")).FakeChannel,
}));
vi.mock("../../../platform/tauri/fs", () => ({
  readTextFile: (path: string) =>
    path.endsWith("b.ts")
      ? Promise.resolve("import { a } from './a';\n  a();")
      : Promise.reject(new Error("missing")),
}));

const symbol = (name: string, line: number): LspSymbol => ({
  name,
  kind: 12,
  container: null,
  path: "/repo/a.ts",
  relative: "a.ts",
  line,
  character: 0,
});

describe("lsp symbols", () => {
  const symbols = [
    symbol("renderHover", 0),
    symbol("hover", 1),
    symbol("x", 2),
  ];

  it("keeps source order without a query", () => {
    expect(rankSymbols(symbols, " ").map((s) => s.name)).toEqual([
      "renderHover",
      "hover",
      "x",
    ]);
  });

  it("filters fuzzily and puts the best match first", () => {
    const ranked = rankSymbols(symbols, "hov");
    expect(ranked.map((s) => s.name)).toEqual(["hover", "renderHover"]);
    expect(ranked[0].positions).toEqual([0, 1, 2]);
  });

  it("labels every kind, unknown ones included", () => {
    expect(symbolBadge(5).label).toBe("Class");
    expect(symbolBadge(99).label).toBe("Symbol");
  });

  it("flattens document symbol trees and symbol information", () => {
    const tree = [
      {
        name: "Greeter",
        kind: 5,
        range: { start: { line: 0, character: 0 } },
        selectionRange: { start: { line: 0, character: 6 } },
        children: [
          {
            name: "greet",
            kind: 6,
            range: { start: { line: 1, character: 2 } },
            selectionRange: { start: { line: 1, character: 2 } },
          },
        ],
      },
    ];
    const symbols = parseSymbols(tree, "/repo/a.ts", "/repo");
    expect(
      symbols.map((s) => [s.name, s.container, s.line, s.character]),
    ).toEqual([
      ["Greeter", null, 0, 6],
      ["greet", "Greeter", 1, 2],
    ]);

    expect(
      parseSymbols(
        [
          {
            name: "helper",
            kind: 12,
            containerName: "",
            location: {
              uri: "file:///repo/lib/b.ts",
              range: { start: { line: 4, character: 16 } },
            },
          },
        ],
        "/repo/a.ts",
        "/repo",
      ),
    ).toEqual([
      {
        name: "helper",
        kind: 12,
        container: null,
        path: "/repo/lib/b.ts",
        relative: "lib/b.ts",
        line: 4,
        character: 16,
      },
    ]);
    expect(parseSymbols(null, "/repo/a.ts", "/repo")).toEqual([]);
  });

  it("previews references from the editor's unsaved text and from disk", async () => {
    const server = fakeTsgo(invoke, () => [
      { uri: "file:///w/a.ts", range: { start: { line: 1, character: 2 } } },
      { uri: "file:///w/b.ts", range: { start: { line: 1, character: 2 } } },
      { uri: "file:///w/gone.ts", range: { start: { line: 0, character: 0 } } },
    ]);
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: "const a = 1;\n  use(a);",
        extensions: editorLanguageServer("/w/a.ts"),
      }),
    });

    const references = await findReferences({ view, path: "/w/a.ts" }, 6);
    view.destroy();

    expect(server.sent.at(-1)?.params.context).toEqual({
      includeDeclaration: false,
    });
    expect(references).toEqual([
      {
        path: "/w/a.ts",
        relative: "/w/a.ts",
        line: 2,
        column: 3,
        preview: "  use(a);",
      },
      expect.objectContaining({ path: "/w/b.ts", preview: "  a();" }),
      expect.objectContaining({ path: "/w/gone.ts", preview: "" }),
    ]);
  });
});
