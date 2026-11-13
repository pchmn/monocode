import { useEffect, useState } from "react";
import { IS_MAC } from "../../../platform/tauri/platform";
import { keybindingPressed } from "../../settings/model/settings";
import { WORKSPACE_SYMBOL_COMMAND } from "../../settings/model/editorKeybindings";
import {
  currentScriptEditor,
  LSP_NAVIGATION_EVENT,
  type LspNavigationRequest,
} from "../editor/editorLspNavigation";
import { ReferencesPanel } from "./ReferencesPanel";
import { SymbolPicker } from "./SymbolPicker";

function workspaceSymbolDefault(event: KeyboardEvent): boolean {
  const mod = IS_MAC ? event.metaKey : event.ctrlKey;
  const other = IS_MAC ? event.ctrlKey : event.metaKey;
  return (
    mod && !other && event.altKey && !event.shiftKey && event.code === "KeyO"
  );
}

/** Symbol pickers and the references list opened from script editors. */
export function LspNavigationHost() {
  const [request, setRequest] = useState<LspNavigationRequest | null>(null);

  useEffect(() => {
    const onRequest = (event: Event) => {
      setRequest((event as CustomEvent<LspNavigationRequest>).detail);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.isComposing || event.defaultPrevented) return;
      if (
        !keybindingPressed(
          WORKSPACE_SYMBOL_COMMAND,
          event,
          workspaceSymbolDefault(event),
        )
      ) {
        return;
      }
      event.preventDefault();
      setRequest({ kind: "workspaceSymbols", source: currentScriptEditor() });
    };
    window.addEventListener(LSP_NAVIGATION_EVENT, onRequest);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(LSP_NAVIGATION_EVENT, onRequest);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!request) return null;
  const close = () => setRequest(null);
  if (request.kind === "references") {
    return (
      <ReferencesPanel
        key={`${request.source.path}:${request.pos}`}
        source={request.source}
        pos={request.pos}
        onClose={close}
      />
    );
  }
  return (
    <SymbolPicker
      key={request.kind}
      scope={request.kind === "documentSymbols" ? "document" : "workspace"}
      source={request.source}
      onClose={close}
    />
  );
}
