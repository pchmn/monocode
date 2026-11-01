import { useSyncExternalStore } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "../../../platform/tauri/fs";
import {
  joinPath,
  parentPath,
  pathKey,
  slash,
} from "../../../shared/lib/paths";
import { REMOTE_PATH_PREFIX } from "../../../shared/lib/remotePaths";
import { worktreeFocus } from "../../source-control/model/worktreeFocus";
import type { Worktree, Worktrees } from "../../source-control/model/worktrees";

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

/** Starts a workspace session in the sidebar's folder, or in the first one until the user picks. */
export function withWorkspaceFolder<
  T extends { id: string; cwd: string; worktreeCwd?: string },
>(session: T): T {
  if (!isCodeWorkspace(session.cwd)) return session;
  const focus = worktreeFocus(session.cwd);
  const folder = focus?.path ?? projectWorkDir(session.cwd);
  if (folder === session.cwd) return session;
  if (!focus) setWorkspaceFolderPending(session.id, true);
  return { ...session, worktreeCwd: folder };
}

/** The folder something keyed by `project` should run in: a workspace has no directory of its own. */
export function projectWorkDir(project: string): string {
  if (!isCodeWorkspace(project)) return project;
  return codeWorkspaceFolders(project)?.[0]?.path ?? project;
}

export async function pickCodeWorkspace(): Promise<string | null> {
  const selected = await open({
    directory: false,
    multiple: false,
    title: "Open VS Code workspace",
    filters: [{ name: "VS Code workspace", extensions: ["code-workspace"] }],
  });
  if (typeof selected !== "string" || !selected) return null;
  // The project's first session needs the folders to pick a working directory.
  await loadCodeWorkspace(slash(selected));
  return slash(selected);
}

// Sessions still on their default folder: the composer asks before the first send.
const pendingFolders = new Set<string>();
const pendingListeners = new Set<() => void>();

export function setWorkspaceFolderPending(sessionId: string, pending: boolean) {
  if (pendingFolders.has(sessionId) === pending) return;
  if (pending) pendingFolders.add(sessionId);
  else pendingFolders.delete(sessionId);
  for (const listener of pendingListeners) listener();
}

export function isWorkspaceFolderPending(sessionId: string): boolean {
  return pendingFolders.has(sessionId);
}

const folderAsks = new Map<string, number>();

/** Opens the session's folder picker when its folder is still unconfirmed; true if it did. */
export function askWorkspaceFolder(sessionId: string): boolean {
  if (!pendingFolders.has(sessionId)) return false;
  folderAsks.set(sessionId, (folderAsks.get(sessionId) ?? 0) + 1);
  for (const listener of pendingListeners) listener();
  return true;
}

export function useWorkspaceFolderAsks(sessionId: string | undefined) {
  return useSyncExternalStore(
    (listener) => {
      pendingListeners.add(listener);
      return () => pendingListeners.delete(listener);
    },
    () => (sessionId ? (folderAsks.get(sessionId) ?? 0) : 0),
  );
}

export function useWorkspaceFolderPending(sessionId: string | undefined) {
  return useSyncExternalStore(
    (listener) => {
      pendingListeners.add(listener);
      return () => pendingListeners.delete(listener);
    },
    () => !!sessionId && pendingFolders.has(sessionId),
  );
}

export function workspaceFolderWorktree(
  path: string,
  isMain = false,
): Worktree {
  return {
    path,
    branch: null,
    head: "",
    isMain,
    locked: false,
    prunable: false,
    missing: false,
    dirty: null,
    unpushed: null,
    sessionIds: [],
  };
}

/** A workspace's folders as its working copies; the file itself stands for "all folders". */
export async function listCodeWorkspaceFolders(
  file: string,
): Promise<Worktrees> {
  const folders = await loadCodeWorkspace(file);
  return {
    worktrees: [
      workspaceFolderWorktree(file, true),
      ...folders.map((folder) => workspaceFolderWorktree(folder.path)),
    ],
    defaultRoot: "",
  };
}
