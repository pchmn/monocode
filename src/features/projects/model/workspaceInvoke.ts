import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import {
  codeWorkspaceFolders,
  isCodeWorkspace,
  loadCodeWorkspace,
} from "./codeWorkspace";
import { recordWorkspaceRepos } from "../../inbox/model/workspaceRepos";

/** `invoke` for commands keyed by a project `cwd`: a VS Code workspace runs in its first folder. */
export async function invoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const cwd = args?.cwd;
  if (typeof cwd !== "string" || !isCodeWorkspace(cwd))
    return tauriInvoke<T>(cmd, args);
  const folders = codeWorkspaceFolders(cwd) ?? (await loadCodeWorkspace(cwd));
  if (cmd === "git_github_repositories" && folders.length > 1)
    return workspaceRepositories(cwd, folders) as Promise<T>;
  return tauriInvoke<T>(cmd, { ...args, cwd: folders[0]?.path ?? cwd });
}

// The workspace's repos across its folders; a folder outside GitHub is skipped.
async function workspaceRepositories(
  workspace: string,
  folders: readonly { path: string }[],
): Promise<string[]> {
  const results = await Promise.allSettled(
    folders.map((folder) =>
      tauriInvoke<string[]>("git_github_repositories", { cwd: folder.path }),
    ),
  );
  const repos = [
    ...new Set(
      results.flatMap((result) =>
        result.status === "fulfilled" ? result.value : [],
      ),
    ),
  ];
  recordWorkspaceRepos(workspace, repos);
  return repos;
}
