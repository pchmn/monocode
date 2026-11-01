import { useSyncExternalStore } from "react";
import { readTextFile } from "../../../platform/tauri/fs";
import {
  joinPath,
  parentPath,
  pathKey,
  slash,
} from "../../../shared/lib/paths";
import { REMOTE_PATH_PREFIX } from "../../../shared/lib/remotePaths";

export type CodeWorkspaceFolder = { path: string; name: string };

const EXTENSION = ".code-workspace";
const EMPTY: CodeWorkspaceFolder[] = [];
const cache = new Map<string, CodeWorkspaceFolder[]>();
const listeners = new Set<() => void>();

export function isCodeWorkspace(path: string | null | undefined): boolean {
  return (
    !!path &&
    !path.startsWith(REMOTE_PATH_PREFIX) &&
    path.toLowerCase().endsWith(EXTENSION)
  );
}

/** VS Code writes JSONC: comments and trailing commas are legal. */
function stripJsonc(text: string): string {
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (ch === "\\") out += text[++i] ?? "";
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (ch === "/" && text[i + 1] === "*") {
      i = text.indexOf("*/", i + 2);
      if (i < 0) break;
      i++;
    } else {
      out += ch;
    }
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

function isAbsolute(path: string): boolean {
  return path.startsWith("/") || /^[A-Za-z]:[/\\]/.test(path);
}

/** Folders given by `uri` (remote, virtual) are skipped: only `path` names a local folder. */
export function parseCodeWorkspace(
  text: string,
  file: string,
): CodeWorkspaceFolder[] {
  const parsed: unknown = JSON.parse(stripJsonc(text));
  const folders = (parsed as { folders?: unknown })?.folders;
  if (!Array.isArray(folders)) return [];
  const root = parentPath(slash(file));
  const seen = new Set<string>();
  const out: CodeWorkspaceFolder[] = [];
  for (const entry of folders) {
    const raw = (entry as { path?: unknown })?.path;
    if (typeof raw !== "string" || !raw.trim()) continue;
    const path = isAbsolute(raw)
      ? joinPath(slash(raw), ".")
      : joinPath(root, raw);
    if (seen.has(pathKey(path))) continue;
    seen.add(pathKey(path));
    const name = (entry as { name?: unknown }).name;
    out.push({
      path,
      name:
        typeof name === "string" && name.trim()
          ? name.trim()
          : (path.split("/").pop() ?? path),
    });
  }
  return out;
}

export function codeWorkspaceFolders(
  file: string,
): CodeWorkspaceFolder[] | undefined {
  return cache.get(pathKey(file));
}

// shortcut: the file is read once per open, edits made in VS Code show after reopening the project.
export async function loadCodeWorkspace(
  file: string,
): Promise<CodeWorkspaceFolder[]> {
  let folders: CodeWorkspaceFolder[];
  try {
    folders = parseCodeWorkspace(await readTextFile(file), file);
  } catch (error) {
    console.warn(`Could not read ${file}`, error);
    folders = EMPTY;
  }
  cache.set(pathKey(file), folders);
  for (const listener of listeners) listener();
  return folders;
}

export function useCodeWorkspaceFolders(
  file: string,
): CodeWorkspaceFolder[] | undefined {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      if (isCodeWorkspace(file) && !cache.has(pathKey(file)))
        void loadCodeWorkspace(file);
      return () => listeners.delete(listener);
    },
    () => (isCodeWorkspace(file) ? codeWorkspaceFolders(file) : undefined),
  );
}

/** The folder something keyed by `project` should run in: a workspace has no directory of its own. */
export function projectWorkDir(project: string): string {
  if (!isCodeWorkspace(project)) return project;
  return codeWorkspaceFolders(project)?.[0]?.path ?? project;
}
