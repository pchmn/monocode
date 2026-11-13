import { ALT, IS_MAC, MOD, SHIFT } from "../../../platform/tauri/platform";
import type { KeybindingRow } from "./settings";

const CTRL = IS_MAC ? "⌃" : "Ctrl+";

// Display modifiers must follow the ⌘ ⌃ ⌥ ⇧ order `defaultShortcutsFor` parses.
const KEYS = {
  "Editor: Toggle Line Comment": `${MOD}/`,
  "Editor: Toggle Block Comment": `${ALT}${SHIFT}A`,
  "Editor: Move Line Up": `${ALT}↑`,
  "Editor: Move Line Down": `${ALT}↓`,
  "Editor: Copy Line Up": `${ALT}${SHIFT}↑`,
  "Editor: Copy Line Down": `${ALT}${SHIFT}↓`,
  "Editor: Delete Line": `${MOD}${SHIFT}K`,
  "Editor: Select Line": `${MOD}L`,
  "Editor: Insert Line Below": `${MOD}Enter`,
  "Editor: Insert Line Above": `${MOD}${SHIFT}Enter`,
  "Editor: Add Next Occurrence": `${MOD}D`,
  "Editor: Select All Occurrences": `${MOD}${SHIFT}L`,
  "Editor: Go to Bracket": `${MOD}${SHIFT}\\`,
  "Editor: Expand Selection": IS_MAC
    ? `${MOD}${CTRL}${SHIFT}→`
    : `${ALT}${SHIFT}→`,
  ...(IS_MAC ? { "Editor: Go to Line": `${CTRL}G` } : {}),
};

export type EditorKeyCommand = keyof typeof KEYS | "Editor: Go to Line";

export const EDITOR_KEYBINDINGS: KeybindingRow[] = Object.entries(KEYS).map(
  ([command, keys]) => ({ command, keys, when: "editorFocus" }),
);
