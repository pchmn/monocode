import type { Theme } from "@tauri-apps/api/window";
import { loadThemePreference, resolveColorScheme } from "./appearance";

// Tauri's setTheme sets NSApp.appearance, so a fixed value would stop every
// window's prefers-color-scheme from following the OS.
export function nativeWindowTheme(): Theme | null {
  const preference = loadThemePreference();
  return preference === "system" ? null : resolveColorScheme(preference);
}
