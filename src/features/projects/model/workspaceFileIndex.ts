import type { ProjectFile } from "../../../platform/tauri/fs";
import { loadProjectFiles, peekProjectFiles } from "../../files/model/fileIndex";
import { codeWorkspaceFolders, isCodeWorkspace, type CodeWorkspaceFolder } from "./codeWorkspace";
import { foldersInWorktree, workspaceFolderOf } from "./workspaceFolderWorktrees";

const prefixed = new WeakMap<ProjectFile[], { name: string; files: ProjectFile[] }>();

/** Every folder of the workspace `cwd` belongs to, with `cwd` in place of its folder when it is a worktree. */
export function workspaceSearchFolders(
  workspace: string | undefined,
  cwd: string,
): CodeWorkspaceFolder[] | undefined {
  if (!workspace || !isCodeWorkspace(workspace)) return undefined;
  const folders = codeWorkspaceFolders(workspace);
  if (!folders?.length) return undefined;
  return foldersInWorktree(folders, workspaceFolderOf(workspace, cwd), cwd);
}

// The folder name leads `relative` so results show, and match, which folder they come from.
function underFolder(folder: CodeWorkspaceFolder, files: ProjectFile[]): ProjectFile[] {
  const hit = prefixed.get(files);
  if (hit?.name === folder.name) return hit.files;
  const out = files.map((file) => ({ ...file, relative: `${folder.name}/${file.relative}` }));
  prefixed.set(files, { name: folder.name, files: out });
  return out;
}

function merge(folders: CodeWorkspaceFolder[], listings: (ProjectFile[] | null)[]): ProjectFile[] {
  const seen = new Set<string>();
  const out: ProjectFile[] = [];
  folders.forEach((folder, i) => {
    for (const file of underFolder(folder, listings[i] ?? [])) {
      // Nested workspace folders list the same file twice.
      if (seen.has(file.path)) continue;
      seen.add(file.path);
      out.push(file);
    }
  });
  return out;
}

export function peekSearchFiles(cwd: string, workspace?: string): ProjectFile[] | null {
  const folders = workspaceSearchFolders(workspace, cwd);
  if (!folders) return peekProjectFiles(cwd);
  const listings = folders.map((folder) => peekProjectFiles(folder.path));
  return listings.some(Boolean) ? merge(folders, listings) : null;
}

export async function loadSearchFiles(cwd: string, workspace?: string): Promise<ProjectFile[]> {
  const folders = workspaceSearchFolders(workspace, cwd);
  if (!folders) return loadProjectFiles(cwd, true);
  const listings = await Promise.all(
    folders.map((folder) => loadProjectFiles(folder.path, true).catch(() => null)),
  );
  return merge(folders, listings);
}
