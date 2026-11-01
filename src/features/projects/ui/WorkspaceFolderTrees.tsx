import {
  createRef,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { FileTree } from "../../files/ui/FileTree";
import {
  ExplorerToolbar,
  type ExplorerActions,
} from "../../files/ui/ExplorerToolbar";
import { ChevronDown, ChevronRight } from "../../../shared/ui/icons";
import { slash } from "../../../shared/lib/paths";
import { useGitFileStatuses } from "../../source-control/hooks/useGitFileStatuses";
import type { CodeWorkspaceFolder } from "../model/codeWorkspace";

type Actions = Pick<
  ComponentProps<typeof FileTree>,
  "onOpenFile" | "onOpenTerminal" | "onFileMoved" | "onFileDeleted"
>;

/** The explorer of a VS Code workspace: one tree per folder, as VS Code lists them. */
export function WorkspaceFolderTrees({
  workspace,
  folders,
  enabled,
  ...actions
}: {
  workspace: string;
  folders: CodeWorkspaceFolder[];
  enabled: boolean;
} & Actions) {
  const [open, setOpen] = useState(true);
  const trees = useMemo(
    () => folders.map(() => createRef<ExplorerActions>()),
    [folders],
  );
  // New files land in the folder the user last interacted with, like VS Code.
  const active = useRef(0);
  const activeTree = () => (trees[active.current] ?? trees[0])?.current;
  const name = (slash(workspace).split("/").pop() ?? "").replace(
    /\.code-workspace$/i,
    "",
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center">
        <button
          type="button"
          aria-expanded={open}
          title={workspace}
          onClick={() => setOpen((v) => !v)}
          className="flex h-full min-w-0 flex-1 items-center gap-1 pl-2 text-left outline-none focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-accent/40"
        >
          <span className="grid size-4 shrink-0 place-items-center text-content/50">
            {open ? (
              <ChevronDown className="size-3.5" strokeWidth={1.75} />
            ) : (
              <ChevronRight className="size-3.5" strokeWidth={1.75} />
            )}
          </span>
          <span className="min-w-0 truncate text-[11px] font-semibold tracking-[0.08em] text-content/50 uppercase">
            {name} (Workspace)
          </span>
        </button>
        <ExplorerToolbar
          newFile={() => {
            setOpen(true);
            activeTree()?.newFile();
          }}
          newFolder={() => {
            setOpen(true);
            activeTree()?.newFolder();
          }}
          collapseAll={() => trees.forEach((t) => t.current?.collapseAll())}
        />
      </div>
      <div
        className={`min-h-0 flex-1 overflow-y-auto overscroll-none ${open ? "" : "hidden"}`}
      >
        {folders.map((folder, i) => (
          <div
            key={folder.path}
            className="shrink-0"
            onPointerDownCapture={() => (active.current = i)}
            onFocusCapture={() => (active.current = i)}
          >
            <FolderTree
              folder={folder}
              enabled={enabled}
              actionsRef={trees[i]}
              {...actions}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function FolderTree({
  folder,
  enabled,
  ...actions
}: {
  folder: CodeWorkspaceFolder;
  enabled: boolean;
  actionsRef: ComponentProps<typeof FileTree>["actionsRef"];
} & Actions) {
  const gitStatuses = useGitFileStatuses(folder.path, enabled);
  return (
    <FileTree
      cwd={folder.path}
      rootLabel={folder.name}
      workspaceRoot
      gitStatuses={gitStatuses}
      {...actions}
    />
  );
}
