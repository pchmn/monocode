import {
  copyLineDown,
  copyLineUp,
  cursorMatchingBracket,
  deleteLine,
  insertBlankLine,
  moveLineDown,
  moveLineUp,
  selectLine,
  selectParentSyntax,
  toggleBlockComment,
  toggleComment,
} from "@codemirror/commands";
import {
  gotoLine,
  selectNextOccurrence,
  selectSelectionMatches,
} from "@codemirror/search";
import {
  EditorSelection,
  EditorState,
  Prec,
  type Extension,
} from "@codemirror/state";
import {
  EditorView,
  keymap,
  rectangularSelection,
  type Command,
} from "@codemirror/view";
import type { EditorKeyCommand } from "../../settings/model/editorKeybindings";
import {
  loadKeybindingOverrides,
  shortcutMatches,
} from "../../settings/model/settings";

function insertLineAbove(view: EditorView): boolean {
  if (view.state.readOnly) return false;
  const changes = view.state.changeByRange((range) => {
    const line = view.state.doc.lineAt(range.head);
    const indent = /^\s*/.exec(line.text)?.[0] ?? "";
    return {
      changes: { from: line.from, insert: `${indent}\n` },
      range: EditorSelection.cursor(line.from + indent.length),
    };
  });
  view.dispatch(changes, { scrollIntoView: true, userEvent: "input" });
  return true;
}

type EditorKey = {
  command: EditorKeyCommand;
  key?: string;
  mac?: string;
  run: Command;
};

// Defaults follow VS Code; several shadow CodeMirror's defaultKeymap so a
// rebind or disable in Settings also silences CodeMirror's own binding.
const EDITOR_KEYS: EditorKey[] = [
  { command: "Editor: Toggle Line Comment", key: "Mod-/", run: toggleComment },
  {
    command: "Editor: Toggle Block Comment",
    key: "Shift-Alt-a",
    run: toggleBlockComment,
  },
  { command: "Editor: Move Line Up", key: "Alt-ArrowUp", run: moveLineUp },
  {
    command: "Editor: Move Line Down",
    key: "Alt-ArrowDown",
    run: moveLineDown,
  },
  {
    command: "Editor: Copy Line Up",
    key: "Shift-Alt-ArrowUp",
    run: copyLineUp,
  },
  {
    command: "Editor: Copy Line Down",
    key: "Shift-Alt-ArrowDown",
    run: copyLineDown,
  },
  { command: "Editor: Delete Line", key: "Shift-Mod-k", run: deleteLine },
  { command: "Editor: Select Line", key: "Mod-l", run: selectLine },
  {
    command: "Editor: Insert Line Below",
    key: "Mod-Enter",
    run: insertBlankLine,
  },
  {
    command: "Editor: Insert Line Above",
    key: "Shift-Mod-Enter",
    run: insertLineAbove,
  },
  {
    command: "Editor: Add Next Occurrence",
    key: "Mod-d",
    run: selectNextOccurrence,
  },
  {
    command: "Editor: Select All Occurrences",
    key: "Shift-Mod-l",
    run: selectSelectionMatches,
  },
  {
    command: "Editor: Go to Bracket",
    key: "Shift-Mod-\\",
    run: cursorMatchingBracket,
  },
  {
    command: "Editor: Expand Selection",
    key: "Shift-Alt-ArrowRight",
    mac: "Ctrl-Shift-Mod-ArrowRight",
    run: selectParentSyntax,
  },
  // Ctrl-g stays find-next on Windows/Linux, where it is Mod-g.
  { command: "Editor: Go to Line", mac: "Ctrl-g", run: gotoLine },
];

const defaultChords = keymap.of(
  EDITOR_KEYS.map(({ command, key, mac, run }) => ({
    key,
    mac,
    // A rebound or disabled command must not fall through to CodeMirror's.
    run: (view) => (command in loadKeybindingOverrides() ? true : run(view)),
    preventDefault: true,
  })),
);

const reboundChords = EditorView.domEventHandlers({
  keydown(event, view) {
    if (event.isComposing) return false;
    const overrides = loadKeybindingOverrides();
    for (const { command, run } of EDITOR_KEYS) {
      const shortcut = overrides[command]?.shortcut;
      if (!shortcut || !shortcutMatches(shortcut, event)) continue;
      event.preventDefault();
      run(view);
      return true;
    }
    return false;
  },
});

export const editorVscodeKeys: Extension = [
  Prec.highest(reboundChords),
  Prec.high(defaultChords),
  EditorState.allowMultipleSelections.of(true),
  EditorView.clickAddsSelectionRange.of((event) => event.altKey),
  rectangularSelection({
    eventFilter: (event) => event.altKey && event.shiftKey,
  }),
];
