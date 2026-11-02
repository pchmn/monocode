import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import {
  codeWorkspaceFolders,
  isCodeWorkspace,
  loadCodeWorkspace,
} from "./codeWorkspace";

/** `invoke` for commands keyed by a project `cwd`: a VS Code workspace runs in its first folder. */
// shortcut: other folders' repos are ignored; resolve each folder if workspaces ever mix repos.
export async function invoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const cwd = args?.cwd;
  if (typeof cwd !== "string" || !isCodeWorkspace(cwd))
    return tauriInvoke<T>(cmd, args);
  const folders = codeWorkspaceFolders(cwd) ?? (await loadCodeWorkspace(cwd));
  return tauriInvoke<T>(cmd, { ...args, cwd: folders[0]?.path ?? cwd });
}
