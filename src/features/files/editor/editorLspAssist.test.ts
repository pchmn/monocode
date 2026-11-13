// @vitest-environment happy-dom
import {
  CompletionContext,
  type Completion,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { javascript } from "@codemirror/lang-javascript";
import {
  forceLinting,
  forEachDiagnostic,
  type Diagnostic,
} from "@codemirror/lint";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it, vi } from "vitest";
import { editorLint } from "./editorLint";
import { editorLspAssist } from "./editorLspAssist";
import {
  boost,
  infoMarkdown,
  lspCompletionSource,
  lspToSnippet,
} from "./editorLspCompletion";
import { openQuickFix } from "./editorQuickFix";
import { activeParameterRange } from "./editorSignatureHelp";
import { fakeTsgo } from "./lsp/fakeTsgo";
import { editorLanguageServer } from "./lsp/languageServer";
import { applyTextEdits, editsByUri } from "./lsp/workspaceEdit";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", async () => ({
  invoke,
  Channel: (await import("./lsp/fakeTsgo")).FakeChannel,
}));

const PATH = "/repo/src/main.ts";
const URI = `file://${PATH}`;
const views: EditorView[] = [];

function editor(doc: string, cursor = 0, onErrorCount?: (n: number) => void) {
  const view = new EditorView({
    parent: document.body,
    state: EditorState.create({
      doc,
      selection: EditorSelection.cursor(cursor),
      extensions: [
        javascript({ typescript: true }),
        editorLanguageServer(PATH),
        editorLint(PATH, onErrorCount),
        editorLspAssist(PATH),
      ],
    }),
  });
  views.push(view);
  return view;
}

function range(line: number, from: number, to: number) {
  return {
    start: { line, character: from },
    end: { line, character: to },
  };
}

function diagnostics(view: EditorView) {
  const found: Pick<
    Diagnostic,
    "from" | "to" | "severity" | "message" | "markClass"
  >[] = [];
  forEachDiagnostic(view.state, ({ severity, message, markClass }, from, to) =>
    found.push({ from, to, severity, message, markClass }),
  );
  return found;
}

async function linted(view: EditorView) {
  await vi.waitFor(() => {
    forceLinting(view);
    expect(diagnostics(view).length).toBeGreaterThan(0);
  });
}

afterEach(() => {
  for (const view of views.splice(0)) view.destroy();
  invoke.mockReset();
});

const MISSING_NAME = {
  range: range(0, 0, 10),
  severity: 1,
  code: 2304,
  source: "ts",
  message: "Cannot find name 'formatDate'.",
};

describe("tsgo diagnostics", () => {
  it("replaces the syntax lint, fades unused code and counts errors only", async () => {
    fakeTsgo(invoke, (method) =>
      method === "textDocument/diagnostic"
        ? {
            kind: "full",
            items: [
              MISSING_NAME,
              {
                range: range(1, 6, 7),
                severity: 4,
                code: 6133,
                message: "'n' is declared but its value is never read.",
              },
            ],
          }
        : null,
    );
    const counts: number[] = [];
    // `(` unclosed: the syntax lint would flag it.
    const view = editor("formatDate(\nconst n = 1;", 0, (n) => counts.push(n));
    await linted(view);

    expect(diagnostics(view)).toEqual([
      {
        from: 0,
        to: 10,
        severity: "error",
        message: "Cannot find name 'formatDate'.",
        markClass: undefined,
      },
      {
        from: 18,
        to: 19,
        severity: "hint",
        message: "'n' is declared but its value is never read.",
        markClass: "cm-lsp-unnecessary",
      },
    ]);
    expect(counts.at(-1)).toBe(1);
  });

  it("keeps the syntax lint when tsgo cannot start", async () => {
    invoke.mockImplementation(async (command: string, args: any) => {
      if (command === "lsp_document") {
        return {
          root: "/missing",
          rootUri: "file:///missing",
          uri: `file://${args.path}`,
          languageId: "typescript",
        };
      }
      if (command === "lsp_connect") throw new Error("tsgo not found");
    });
    const view = editor("function go() {\n  return 1;\n");
    await linted(view);
    expect(diagnostics(view)[0]?.severity).toBe("error");
  });
});

describe("quick fixes", () => {
  it("sends the diagnostics on the caret's line and applies the chosen fix", async () => {
    const server = fakeTsgo(invoke, (method) => {
      if (method === "textDocument/diagnostic") {
        return { kind: "full", items: [MISSING_NAME] };
      }
      if (method === "textDocument/codeAction") {
        return [
          {
            title: 'Add import from "./util"',
            kind: "quickfix",
            edit: {
              changes: {
                [URI]: [
                  {
                    range: range(0, 0, 0),
                    newText: 'import { formatDate } from "./util";\n',
                  },
                ],
              },
            },
          },
        ];
      }
      return null;
    });
    const view = editor("formatDate(new Date());", 22);
    await linted(view);

    await openQuickFix(view, 22, 22);
    const request = server.sent.find(
      (message) => message.method === "textDocument/codeAction",
    );
    expect(request?.params.range).toEqual(range(0, 0, 10));
    expect(request?.params.context.diagnostics).toHaveLength(1);

    const item = view.dom.querySelector<HTMLElement>(".cm-lsp-quickfix-item");
    expect(item?.textContent).toBe('Add import from "./util"');
    item?.click();
    await vi.waitFor(() =>
      expect(view.state.doc.toString()).toBe(
        'import { formatDate } from "./util";\nformatDate(new Date());',
      ),
    );
  });

  it("applies edits to files on disk", () => {
    expect(
      applyTextEdits("a\nb\nc", [
        { range: range(2, 0, 1), newText: "C" },
        { range: range(0, 0, 0), newText: "// top\n" },
      ]),
    ).toBe("// top\na\nb\nC");
    expect(
      editsByUri({
        documentChanges: [
          {
            textDocument: { uri: "file:///a.ts", version: 1 },
            edits: [{ range: range(0, 0, 0), newText: "x" }],
          },
          { kind: "create", uri: "file:///b.ts" },
        ],
      }),
    ).toEqual(
      new Map([["file:///a.ts", [{ range: range(0, 0, 0), newText: "x" }]]]),
    );
  });
});

describe("tsgo completion", () => {
  async function complete(view: EditorView, explicit = false) {
    const context = new CompletionContext(
      view.state,
      view.state.selection.main.head,
      explicit,
      view,
    );
    return (await lspCompletionSource(context)) as CompletionResult | null;
  }

  function accept(view: EditorView, result: CompletionResult, label: string) {
    const option = result.options.find(
      (candidate) => candidate.label === label,
    )!;
    const apply = option.apply as (
      view: EditorView,
      completion: Completion,
      from: number,
      to: number,
    ) => void;
    apply(view, option, result.from, view.state.selection.main.head);
  }

  it("adds the import of an auto-imported symbol once resolved", async () => {
    fakeTsgo(
      invoke,
      (method, params) => {
        if (method === "textDocument/completion") {
          return {
            isIncomplete: false,
            items: [
              {
                label: "formatDate",
                kind: 3,
                sortText: "16",
                labelDetails: { description: "./util" },
                data: { autoImport: { moduleSpecifier: "./util" } },
              },
            ],
          };
        }
        if (method === "completionItem/resolve") {
          return {
            ...params,
            additionalTextEdits: [
              {
                range: range(0, 0, 0),
                newText: 'import { formatDate } from "./util";\n',
              },
            ],
          };
        }
        return null;
      },
      { completionProvider: { resolveProvider: true } },
    );
    const view = editor("const a = 1;\nform", 17);
    const result = await complete(view);
    expect(result).toMatchObject({ from: 13 });
    expect(result?.options[0]).toMatchObject({
      label: "formatDate",
      detail: "./util",
      type: "function",
      boost: -25,
    });

    accept(view, result!, "formatDate");
    expect(view.state.doc.toString()).toBe("const a = 1;\nformatDate");
    await vi.waitFor(() =>
      expect(view.state.doc.toString()).toBe(
        'import { formatDate } from "./util";\nconst a = 1;\nformatDate',
      ),
    );
  });

  it("asks only after an identifier or a trigger character", async () => {
    const server = fakeTsgo(invoke, () => ({ isIncomplete: false, items: [] }));
    const view = editor("a + ", 4);
    expect(await complete(view)).toBeNull();
    view.dispatch({
      changes: { from: 4, insert: "b." },
      selection: { anchor: 6 },
    });
    await complete(view);
    const request = server.sent.find(
      (message) => message.method === "textDocument/completion",
    );
    expect(request?.params.context).toEqual({
      triggerKind: 2,
      triggerCharacter: ".",
    });
  });

  it("reads TypeScript's sort groups, snippets and details", () => {
    expect(boost("11")).toBe(0);
    expect(boost("15")).toBe(-20);
    expect(boost("z11")).toBe(-99);
    expect(lspToSnippet("foo($1)$0")).toBe("foo(${1})${0}");
    expect(
      infoMarkdown({
        label: "a",
        detail: "(property) a: number",
        documentation: { kind: "markdown", value: "The *a*." },
      }),
    ).toBe("```typescript\n(property) a: number\n```\n\nThe *a*.");
    expect(infoMarkdown({ label: "a", detail: 'Add import from "./a"' })).toBe(
      'Add import from "./a"',
    );
  });
});

describe("signature help", () => {
  it("opens on an auto-closed parenthesis with the active parameter in bold", async () => {
    const server = fakeTsgo(invoke, (method) =>
      method === "textDocument/signatureHelp"
        ? {
            signatures: [
              {
                label: "formatDate(date: Date, utc: boolean): string",
                parameters: [
                  { label: "date: Date" },
                  { label: "utc: boolean" },
                ],
              },
            ],
            activeSignature: 0,
            activeParameter: 0,
          }
        : null,
    );
    const view = editor("formatDate", 10);
    view.dispatch({
      changes: { from: 10, insert: "()" },
      selection: { anchor: 11 },
      userEvent: "input.type",
    });
    await vi.waitFor(() =>
      expect(
        [...view.dom.querySelectorAll(".cm-lsp-signature strong")]
          .map((part) => part.textContent)
          .join(""),
      ).toBe("date: Date"),
    );
    const request = server.sent.find(
      (message) => message.method === "textDocument/signatureHelp",
    );
    expect(request?.params.context).toMatchObject({
      triggerKind: 2,
      triggerCharacter: "(",
    });
  });

  it("finds the active parameter after the name", () => {
    const signature = {
      label: "date(date: Date, options: { date: boolean }): string",
      parameters: [
        { label: "date: Date" },
        { label: "options: { date: boolean }" },
      ],
    };
    expect(activeParameterRange(signature, 0)).toEqual([5, 15]);
    expect(activeParameterRange(signature, 1)).toEqual([17, 43]);
    expect(
      activeParameterRange({ ...signature, activeParameter: 0 }, 1),
    ).toEqual([5, 15]);
    expect(
      activeParameterRange(
        { label: "f(a)", parameters: [{ label: [2, 3] }] },
        0,
      ),
    ).toEqual([2, 3]);
    expect(activeParameterRange(signature, 5)).toBeNull();
  });
});
