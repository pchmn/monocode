import type { ReactNode } from "react";
import { MOD } from "../../../platform/tauri/platform";
import {
  FilePlus,
  FolderPlus,
  FoldVertical,
  Search,
} from "../../../shared/ui/icons";

export type ExplorerActions = {
  newFile: () => void;
  newFolder: () => void;
  collapseAll: () => void;
};

export function ExplorerToolbar({
  onSearch,
  newFile,
  newFolder,
  collapseAll,
}: ExplorerActions & { onSearch?: () => void }) {
  return (
    <div
      role="toolbar"
      aria-label="Explorer"
      className="flex shrink-0 items-center gap-0.5 pr-2"
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {onSearch ? (
        <ToolbarIcon
          label={`Search in files (${MOD}Shift+F)`}
          onClick={onSearch}
        >
          <Search className="size-3.5" strokeWidth={1.75} />
        </ToolbarIcon>
      ) : null}
      <ToolbarIcon label="New File" onClick={newFile}>
        <FilePlus className="size-3.5" strokeWidth={1.75} />
      </ToolbarIcon>
      <ToolbarIcon label="New Folder" onClick={newFolder}>
        <FolderPlus className="size-3.5" strokeWidth={1.75} />
      </ToolbarIcon>
      <ToolbarIcon label="Collapse All" onClick={collapseAll}>
        <FoldVertical className="size-3.5" strokeWidth={1.75} />
      </ToolbarIcon>
    </div>
  );
}

function ToolbarIcon({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="grid size-6 place-items-center rounded-md text-content/50 hover:bg-content/5 hover:text-content"
    >
      {children}
    </button>
  );
}
