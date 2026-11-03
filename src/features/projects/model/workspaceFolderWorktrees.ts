import { useEffect, useState, useSyncExternalStore } from "react";
import { invokeWorkspace, subscribeGitChanged } from "../../../platform/tauri/fs";
import { pathKey } from "../../../shared/lib/paths";
import type { Worktree, Worktrees } from "../../source-control/model/worktrees";
import {
  codeWorkspaceFolders,
  isCodeWorkspace,
  listCodeWorkspaceFolders,
} from "./codeWorkspace";

type WorkspaceSession = { cwd: string; worktreeCwd?: string };

// Linked worktrees of each workspace folder's repo, keyed by folder.
const folderTrees = new Map<string, Promise<Worktree[]>>();
const ownerFolders = new Map<string, string>();
const knownFolders = new Set<string>();
const listeners = new Set<() => void>();
let watching = false;

function watchGit() {
  if (watching || typeof window === "undefined") return;
  watching = true;
  subscribeGitChanged(() => {
    folderTrees.clear();
    for (const folder of knownFolders) void folderWorktrees(folder);
  });
}

function folderWorktrees(folder: string): Promise<Worktree[]> {
  watchGit();
  knownFolders.add(folder);
  const key = pathKey(folder);
  let trees = folderTrees.get(key);
  if (!trees) {
    trees = invokeWorkspace<Worktrees>("git_worktrees", { cwd: folder })
      .then(({ worktrees }) => {
        for (const tree of worktrees)
          if (pathKey(tree.path) !== key) ownerFolders.set(pathKey(tree.path), folder);
        for (const listener of listeners) listener();
        return worktrees;
      })
      .catch(() => {
        folderTrees.delete(key);
        return [];
      });
    folderTrees.set(key, trees);
  }
  return trees;
}

function workspaceFolder(workspace: string, path: string): string | undefined {
  return codeWorkspaceFolders(workspace)?.find(
    (folder) => pathKey(folder.path) === pathKey(path),
  )?.path;
}

/** The folder a workspace session runs in, or whose worktree it runs in. */
export function workspaceFolderOf(workspace: string, path: string): string | undefined {
  if (!isCodeWorkspace(workspace)) return undefined;
  const folder = workspaceFolder(workspace, path);
  if (folder) return folder;
  const owner = ownerFolders.get(pathKey(path));
  if (owner) return owner;
  for (const entry of codeWorkspaceFolders(workspace) ?? []) void folderWorktrees(entry.path);
  return undefined;
}

export function useWorkspaceFolderOf(workspace: string, path: string) {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => workspaceFolderOf(workspace, path),
  );
}

/** A workspace session's `worktreeCwd` names its folder until it gets a worktree of its own. */
export function hasOwnWorktree(session: WorkspaceSession): boolean {
  return (
    !!session.worktreeCwd &&
    !(isCodeWorkspace(session.cwd) && workspaceFolder(session.cwd, session.worktreeCwd))
  );
}

/** The repository a draft session's new worktree branches from. */
export function draftWorktreeRepo(session: WorkspaceSession): string {
  return (
    (isCodeWorkspace(session.cwd) &&
      session.worktreeCwd &&
      workspaceFolder(session.cwd, session.worktreeCwd)) ||
    session.cwd
  );
}

/** Another folder has other branches: its default branch replaces the base. */
export function workspaceFolderBaseReset(session: {
  cwd: string;
  workspaceMode?: string;
}): { worktreeBase?: string } {
  return isCodeWorkspace(session.cwd) && session.workspaceMode === "worktree"
    ? { worktreeBase: "HEAD" }
    : {};
}

/** The workspace's folders, plus the linked worktrees of each when `path` is one of those. */
export async function listCodeWorkspaceWorktrees(
  file: string,
  path?: string,
): Promise<Worktrees> {
  const listed = await listCodeWorkspaceFolders(file);
  if (!path || workspaceFolder(file, path)) return listed;
  const folders = listed.worktrees.filter((tree) => !tree.isMain);
  const linked = (
    await Promise.all(folders.map((folder) => folderWorktrees(folder.path)))
  )
    .flat()
    .filter((tree) => !workspaceFolder(file, tree.path));
  return { ...listed, worktrees: [...listed.worktrees, ...linked] };
}

/** Worktrees are made from a checkout's top: a folder deeper in a repo would lose its subpath. */
export function useIsCheckoutRoot(folder: string | undefined): boolean {
  const [root, setRoot] = useState<{ folder: string; root: boolean }>();
  useEffect(() => {
    if (!folder) return;
    let live = true;
    void folderWorktrees(folder).then((trees) => {
      if (live)
        setRoot({
          folder,
          root: trees.some((tree) => pathKey(tree.path) === pathKey(folder)),
        });
    });
    return () => {
      live = false;
    };
  }, [folder]);
  return !!folder && root?.folder === folder && root.root;
}
