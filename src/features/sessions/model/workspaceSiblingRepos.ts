import { githubRepo } from "../../inbox/model/githubTasks";
import {
  codeWorkspaceFolders,
  loadedCodeWorkspaces,
} from "../../projects/model/codeWorkspace";
import { workspaceFolderOf } from "../../projects/model/workspaceFolderWorktrees";
import { pathKey } from "../../../shared/lib/paths";

/** GitHub repos (`owner/name`) of the other folders of the open VS Code workspaces holding `cwd`. */
export async function workspaceSiblingRepos(cwd: string): Promise<string[]> {
  const folders = loadedCodeWorkspaces().flatMap((workspace) => {
    const own = workspaceFolderOf(workspace, cwd);
    if (!own) return [];
    return (codeWorkspaceFolders(workspace) ?? []).filter(
      (folder) => pathKey(folder.path) !== pathKey(own),
    );
  });
  const [current, ...repos] = await Promise.allSettled(
    [cwd, ...folders.map((folder) => folder.path)].map(githubRepo),
  );
  const exclude = current?.status === "fulfilled" ? current.value : "";
  return [
    ...new Set(
      repos.flatMap((repo) =>
        repo.status === "fulfilled" && repo.value !== exclude
          ? [repo.value]
          : [],
      ),
    ),
  ];
}
