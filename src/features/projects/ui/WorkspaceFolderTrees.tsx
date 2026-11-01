import type { ComponentProps } from "react";
import { FileTree } from "../../files/ui/FileTree";
import { useGitFileStatuses } from "../../source-control/hooks/useGitFileStatuses";
import type { CodeWorkspaceFolder } from "../model/codeWorkspace";

type Actions = Pick<
  ComponentProps<typeof FileTree>,
  "onOpenFile" | "onOpenTerminal" | "onFileMoved" | "onFileDeleted"
>;

/** The explorer of a VS Code workspace: one tree per folder, as VS Code lists them. */
export function WorkspaceFolderTrees({
  folders,
  enabled,
  ...actions
}: { folders: CodeWorkspaceFolder[]; enabled: boolean } & Actions) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-none">
      {folders.map((folder) => (
        <FolderTree
          key={folder.path}
          folder={folder}
          enabled={enabled}
          {...actions}
        />
      ))}
    </div>
  );
}

function FolderTree({
  folder,
  enabled,
  ...actions
}: { folder: CodeWorkspaceFolder; enabled: boolean } & Actions) {
  const gitStatuses = useGitFileStatuses(folder.path, enabled);
  return (
    <div className="shrink-0">
      <FileTree
        cwd={folder.path}
        rootLabel={folder.name}
        workspaceRoot
        gitStatuses={gitStatuses}
        {...actions}
      />
    </div>
  );
}
