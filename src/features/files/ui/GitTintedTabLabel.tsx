import { TabLabel } from "../../../shared/ui/TabLabel";
import { isFilesystemTab, type FilePaneTab } from "../../workspace/model/layout";
import {
  isCodeWorkspace,
  useCodeWorkspaceFolders,
} from "../../projects/model/codeWorkspace";
import { useGitFileStatuses } from "../../source-control/hooks/useGitFileStatuses";

// Same hues as the explorer, dimmed like the other inactive-tab states.
const ACTIVE_COLOR: Record<string, string> = {
  modified: "text-amber-400",
  added: "text-diff-add-fg",
  untracked: "text-diff-add-fg",
  deleted: "text-diff-del-fg",
};
const INACTIVE_COLOR: Record<string, string> = {
  modified: "text-amber-400/75 group-hover:text-amber-400",
  added: "text-diff-add-fg/75 group-hover:text-diff-add-fg",
  untracked: "text-diff-add-fg/75 group-hover:text-diff-add-fg",
  deleted: "text-diff-del-fg/75 group-hover:text-diff-del-fg",
};

function useStatusRoot(file: FilePaneTab): string {
  const folders = useCodeWorkspaceFolders(file.cwd);
  if (!isCodeWorkspace(file.cwd)) return file.cwd;
  return (
    folders?.find((folder) => file.path.startsWith(`${folder.path}/`))?.path ??
    ""
  );
}

export function GitTintedTabLabel({
  file,
  active,
  tinted,
  className,
  children,
}: {
  file: FilePaneTab;
  active: boolean;
  /** False when another state (problems) already colours the label. */
  tinted: boolean;
  className: string;
  children: string;
}) {
  const filesystem = isFilesystemTab(file);
  const root = useStatusRoot(file);
  const statuses = useGitFileStatuses(root, filesystem && tinted);
  const status = statuses.files.get(file.path);
  const color = status
    ? (active ? ACTIVE_COLOR : INACTIVE_COLOR)[status]
    : undefined;
  return (
    <TabLabel className={color ? `${className} ${color}` : className}>
      {children}
    </TabLabel>
  );
}
