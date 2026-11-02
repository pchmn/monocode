import { describe, expect, it } from "vitest";
import {
  CODE_FONTS_DEFAULT,
  codeFontFamilyCss,
  normalizeCodeFonts,
} from "./codeFonts";

describe("normalizeCodeFonts", () => {
  it("falls back to defaults for missing or invalid values", () => {
    expect(normalizeCodeFonts(undefined)).toEqual(CODE_FONTS_DEFAULT);
    expect(
      normalizeCodeFonts({ codeFontFamily: "  ", codeFontSize: "abc" }),
    ).toEqual(CODE_FONTS_DEFAULT);
  });

  it("clamps sizes to their limits", () => {
    const fonts = normalizeCodeFonts({
      codeFontSize: 2,
      explorerRowHeight: 99,
    });
    expect(fonts.codeFontSize).toBe(8);
    expect(fonts.explorerRowHeight).toBe(48);
  });
});

describe("codeFontFamilyCss", () => {
  it("quotes bare names and keeps the monospace fallback", () => {
    const css = codeFontFamilyCss("Google Sans Code, 'JetBrains Mono'");
    expect(css.startsWith(`"Google Sans Code", 'JetBrains Mono', `)).toBe(true);
    expect(css.endsWith("monospace")).toBe(true);
  });
});
