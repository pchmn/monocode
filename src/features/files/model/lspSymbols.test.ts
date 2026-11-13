import { describe, expect, it } from "vitest";
import { rankSymbols, symbolBadge, type LspSymbol } from "./lspSymbols";

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
});
