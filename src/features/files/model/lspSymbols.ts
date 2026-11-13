import type { EditorView } from "@codemirror/view";
import { readTextFile } from "../../../platform/tauri/fs";
import { fuzzyMatch, type FuzzyHit } from "../../../shared/lib/fuzzy";
import type { ProjectSearchMatch } from "../../search/model/search";
import { lspLocations } from "../editor/editorGoToDefinition";
import {
  lspErrorMessage,
  lspRequest,
  uriToPath,
} from "../editor/lsp/languageServer";

export type LspSymbol = {
  name: string;
  /** LSP `SymbolKind`. */
  kind: number;
  container: string | null;
  path: string;
  relative: string;
  line: number;
  character: number;
};

export type RankedSymbol = LspSymbol & FuzzyHit;

type Editor = { view: EditorView; path: string };

const MAX_WORKSPACE_SYMBOLS = 250;

// Rejects with a readable message, as the pickers print errors with `String`.
async function request<Result>(
  editor: Editor,
  method: string,
  params: Parameters<typeof lspRequest>[2],
) {
  try {
    return await lspRequest<Result>(editor.view, method, params);
  } catch (error) {
    throw lspErrorMessage(error);
  }
}

export async function documentSymbols(editor: Editor): Promise<LspSymbol[]> {
  const response = await request<unknown>(
    editor,
    "textDocument/documentSymbol",
    (plugin) => ({ textDocument: { uri: plugin.uri } }),
  );
  return response
    ? parseSymbols(response.result, editor.path, response.root)
    : [];
}

/** `editor` is an open file of the repository: it picks the server. */
export async function workspaceSymbols(
  editor: Editor,
  query: string,
): Promise<LspSymbol[]> {
  const response = await request<unknown>(editor, "workspace/symbol", () => ({
    query,
  }));
  return response
    ? parseSymbols(response.result, editor.path, response.root).slice(
        0,
        MAX_WORKSPACE_SYMBOLS,
      )
    : [];
}

export async function findReferences(
  editor: Editor,
  pos: number,
): Promise<ProjectSearchMatch[]> {
  const response = await request<unknown>(
    editor,
    "textDocument/references",
    (plugin) => ({
      textDocument: { uri: plugin.uri },
      position: plugin.toPosition(pos),
      context: { includeDeclaration: false },
    }),
  );
  if (!response) return [];
  // The editor's own text stands in for its file so unsaved lines preview as shown.
  const files = new Map<string, Promise<string[]>>([
    [editor.path, Promise.resolve(editor.view.state.doc.toJSON())],
  ]);
  const linesOf = (path: string) => {
    let lines = files.get(path);
    if (!lines) {
      lines = readTextFile(path).then(
        (text) => text.split(/\r?\n/),
        () => [],
      );
      files.set(path, lines);
    }
    return lines;
  };
  return Promise.all(
    lspLocations(response.result).map(async (location) => ({
      path: location.path,
      relative: relativePath(location.path, response.root),
      line: location.line + 1,
      column: location.character + 1,
      preview: (await linesOf(location.path))[location.line] ?? "",
    })),
  );
}

function relativePath(path: string, root: string): string {
  const prefix = root.endsWith("/") ? root : `${root}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

type Position = { line: number; character: number };
type RawSymbol = {
  name?: unknown;
  kind?: number;
  containerName?: string;
  location?: { uri?: string; range?: { start?: Position } };
  range?: { start?: Position };
  selectionRange?: { start?: Position };
  children?: RawSymbol[];
};

/** Flattens `DocumentSymbol` trees and `SymbolInformation`/`WorkspaceSymbol` lists. */
export function parseSymbols(
  result: unknown,
  document: string,
  root: string,
): LspSymbol[] {
  const symbols: LspSymbol[] = [];
  const walk = (item: RawSymbol, container: string | null) => {
    if (typeof item?.name !== "string") return;
    const path = item.location
      ? item.location.uri && uriToPath(item.location.uri)
      : document;
    const start = item.location
      ? item.location.range?.start
      : (item.selectionRange?.start ?? item.range?.start);
    if (path) {
      symbols.push({
        name: item.name,
        kind: item.kind ?? 0,
        container: item.containerName || container,
        path,
        relative: relativePath(path, root),
        line: start?.line ?? 0,
        character: start?.character ?? 0,
      });
    }
    for (const child of item.children ?? []) walk(child, item.name);
  };
  if (Array.isArray(result)) for (const item of result) walk(item, null);
  return symbols;
}

/** An empty query keeps the server's order: source order for a file. */
export function rankSymbols(
  symbols: LspSymbol[],
  query: string,
): RankedSymbol[] {
  if (!query.trim()) {
    return symbols.map((symbol) => ({ ...symbol, score: 0, positions: [] }));
  }
  return symbols
    .flatMap((symbol) => {
      const hit = fuzzyMatch(query, symbol.name);
      return hit ? [{ ...symbol, ...hit }] : [];
    })
    .sort((a, b) => b.score - a.score);
}

export type SymbolBadge = { glyph: string; label: string; className: string };

const FUNCTION = { glyph: "ƒ", className: "text-violet-400" };
const TYPE = { glyph: "T", className: "text-teal-400" };
const VALUE = { glyph: "v", className: "text-sky-400" };
const MEMBER = { glyph: "p", className: "text-sky-300" };

const BADGES: Record<number, SymbolBadge> = {
  2: { glyph: "M", label: "Module", className: "text-content/60" },
  3: { glyph: "N", label: "Namespace", className: "text-content/60" },
  5: { glyph: "C", label: "Class", className: "text-amber-400" },
  6: { ...FUNCTION, label: "Method" },
  7: { ...MEMBER, label: "Property" },
  8: { ...MEMBER, label: "Field" },
  9: { ...FUNCTION, label: "Constructor" },
  10: { glyph: "E", label: "Enum", className: "text-amber-400" },
  11: { glyph: "I", label: "Interface", className: "text-teal-400" },
  12: { ...FUNCTION, label: "Function" },
  13: { ...VALUE, label: "Variable" },
  14: { glyph: "k", label: "Constant", className: "text-sky-400" },
  22: { glyph: "e", label: "Enum Member", className: "text-amber-300" },
  23: { ...TYPE, label: "Struct" },
  26: { ...TYPE, label: "Type Parameter" },
};

export function symbolBadge(kind: number): SymbolBadge {
  return BADGES[kind] ?? { ...VALUE, glyph: "•", label: "Symbol" };
}
