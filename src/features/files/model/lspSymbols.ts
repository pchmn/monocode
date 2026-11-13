import { invoke } from "@tauri-apps/api/core";
import { fuzzyMatch, type FuzzyHit } from "../../../shared/lib/fuzzy";
import type { ProjectSearchMatch } from "../../search/model/search";

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

type Document = { path: string; text: string };

export function documentSymbols(document: Document): Promise<LspSymbol[]> {
  return invoke<LspSymbol[]>("lsp_document_symbols", { request: document });
}

export function workspaceSymbols(
  document: Document,
  query: string,
): Promise<LspSymbol[]> {
  return invoke<LspSymbol[]>("lsp_workspace_symbols", {
    request: { ...document, query },
  });
}

export function findReferences(request: {
  path: string;
  text: string;
  line: number;
  character: number;
}): Promise<ProjectSearchMatch[]> {
  return invoke<ProjectSearchMatch[]>("lsp_references", { request });
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
