import { useSyncExternalStore } from "react";

const CODE_FONTS_KEY = "monocode.codeFonts";
const FALLBACK_MONO_STACK =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

export type CodeFonts = {
  codeFontFamily: string;
  codeFontSize: number;
  codeLineHeight: number;
  explorerFontSize: number;
  explorerRowHeight: number;
};

export type CodeFontNumberKey = Exclude<keyof CodeFonts, "codeFontFamily">;

// VS Code's macOS defaults for the editor and the explorer.
export const CODE_FONTS_DEFAULT: CodeFonts = {
  codeFontFamily: "Google Sans Code",
  codeFontSize: 12,
  codeLineHeight: 18,
  explorerFontSize: 13,
  explorerRowHeight: 22,
};

export const CODE_FONT_LIMITS: Record<
  CodeFontNumberKey,
  { min: number; max: number }
> = {
  codeFontSize: { min: 8, max: 32 },
  codeLineHeight: { min: 12, max: 48 },
  explorerFontSize: { min: 8, max: 24 },
  explorerRowHeight: { min: 16, max: 48 },
};

const listeners = new Set<() => void>();
let current = load();

function normalizeNumber(key: CodeFontNumberKey, value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return CODE_FONTS_DEFAULT[key];
  const { min, max } = CODE_FONT_LIMITS[key];
  return Math.min(max, Math.max(min, Math.round(parsed * 2) / 2));
}

export function normalizeCodeFonts(value: unknown): CodeFonts {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<
    Record<keyof CodeFonts, unknown>
  >;
  const family =
    typeof raw.codeFontFamily === "string" ? raw.codeFontFamily.trim() : "";
  return {
    codeFontFamily: family || CODE_FONTS_DEFAULT.codeFontFamily,
    codeFontSize: normalizeNumber("codeFontSize", raw.codeFontSize),
    codeLineHeight: normalizeNumber("codeLineHeight", raw.codeLineHeight),
    explorerFontSize: normalizeNumber("explorerFontSize", raw.explorerFontSize),
    explorerRowHeight: normalizeNumber(
      "explorerRowHeight",
      raw.explorerRowHeight,
    ),
  };
}

function load(): CodeFonts {
  try {
    const raw = localStorage.getItem(CODE_FONTS_KEY);
    return normalizeCodeFonts(raw ? JSON.parse(raw) : undefined);
  } catch {
    return CODE_FONTS_DEFAULT;
  }
}

export function loadCodeFonts(): CodeFonts {
  return current;
}

/** Unquoted families are quoted, so names with spaces or digits stay valid CSS. */
export function codeFontFamilyCss(family: string): string {
  const names = family
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => (/^["']/.test(name) ? name : `"${name.replace(/"/g, "")}"`));
  return [...names, FALLBACK_MONO_STACK].join(", ");
}

export function applyCodeFonts(fonts: CodeFonts = current) {
  const style = document.documentElement.style;
  style.setProperty(
    "--code-font-family",
    codeFontFamilyCss(fonts.codeFontFamily),
  );
  style.setProperty("--code-font-size", `${fonts.codeFontSize}px`);
  style.setProperty("--code-line-height", `${fonts.codeLineHeight}px`);
  style.setProperty("--explorer-font-size", `${fonts.explorerFontSize}px`);
  style.setProperty("--explorer-row-height", `${fonts.explorerRowHeight}px`);
  // CodeMirror re-measures its line heights on window resize.
  window.dispatchEvent(new Event("resize"));
}

export function saveCodeFonts(patch: Partial<CodeFonts>) {
  current = normalizeCodeFonts({ ...current, ...patch });
  try {
    localStorage.setItem(CODE_FONTS_KEY, JSON.stringify(current));
  } catch {
    // private mode / quota
  }
  applyCodeFonts(current);
  for (const listener of listeners) listener();
  return current;
}

export function resetCodeFonts() {
  return saveCodeFonts(CODE_FONTS_DEFAULT);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCodeFonts(): CodeFonts {
  return useSyncExternalStore(subscribe, loadCodeFonts, loadCodeFonts);
}

export function codeLineHeightPx(): number {
  return current.codeLineHeight;
}
