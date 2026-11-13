import type { Extension } from "@codemirror/state";
import { editorLspCompletion } from "./editorLspCompletion";
import { editorLspDiagnostics } from "./editorLspDiagnostics";
import {
  editorQuickFix,
  organizeImportsCommand,
  quickFixCommand,
} from "./editorQuickFix";
import {
  editorSignatureHelp,
  triggerParameterHints,
} from "./editorSignatureHelp";
import { rebindableKeymap } from "./editorVscodeKeys";
import { supportsLanguageServer } from "./lsp/languageServer";

/** Diagnostics, completion, signature help and quick fixes from tsgo. */
export function editorLspAssist(path: string): Extension {
  if (!supportsLanguageServer(path)) return [];
  return [
    editorLspDiagnostics,
    editorLspCompletion(),
    editorSignatureHelp,
    editorQuickFix,
    rebindableKeymap([
      { command: "Editor: Quick Fix", key: "Alt-Enter", run: quickFixCommand },
      {
        command: "Editor: Organize Imports",
        key: "Shift-Alt-o",
        run: organizeImportsCommand,
      },
      {
        command: "Editor: Trigger Parameter Hints",
        key: "Shift-Ctrl-Space",
        run: triggerParameterHints,
      },
    ]),
  ];
}
