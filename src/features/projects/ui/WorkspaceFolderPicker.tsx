import { useEffect, useRef, useState } from "react";
import {
  setWorkspaceFolderPending,
  useCodeWorkspaceFolders,
  useWorkspaceFolderAsks,
  useWorkspaceFolderPending,
} from "../model/codeWorkspace";
import { pathKey, prettyCwd } from "../../../shared/lib/paths";
import { Popover } from "../../../shared/ui/Popover";
import { Check, Folder } from "../../../shared/ui/icons";

/** Which folder of a VS Code workspace the session runs in. */
export function WorkspaceFolderPicker({
  sessionId,
  workspace,
  executionCwd,
  enabled,
  onSelect,
  onClose,
}: {
  sessionId?: string;
  workspace: string;
  executionCwd: string;
  enabled: boolean;
  onSelect: (path: string) => Promise<void>;
  onClose?: () => void;
}) {
  const folders = useCodeWorkspaceFolders(workspace) ?? [];
  // Still on the default folder: nothing is marked until the user picks one.
  const pending = useWorkspaceFolderPending(sessionId);
  const asks = useWorkspaceFolderAsks(sessionId);
  const [open, onOpenChange] = useState(pending);
  useEffect(() => {
    if (asks) onOpenChange(true);
  }, [asks]);
  const [error, setError] = useState<string>();
  const anchor = useRef<HTMLDivElement>(null);
  const current = pending
    ? undefined
    : folders.find((folder) => pathKey(folder.path) === pathKey(executionCwd));
  const close = () => {
    onOpenChange(false);
    setError(undefined);
    onClose?.();
  };
  const select = async (path: string) => {
    try {
      await onSelect(path);
      if (sessionId) setWorkspaceFolderPending(sessionId, false);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div ref={anchor} className="relative flex min-w-0 shrink">
      <button
        type="button"
        disabled={!enabled || folders.length === 0}
        title={`Workspace folder: ${prettyCwd(executionCwd)}`}
        aria-label="Choose workspace folder"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : onOpenChange(true))}
        className={`-ml-1.5 flex h-6 min-w-0 max-w-64 items-center gap-1.5 rounded-md px-1.5 text-[12px] ${pending ? "text-accent" : "text-content/55"} hover:bg-content/8 hover:text-content aria-expanded:bg-content/8 aria-expanded:text-content disabled:opacity-40 disabled:hover:bg-transparent active:scale-[0.97]`}
      >
        <Folder className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          {current?.name ?? "Choose folder"}
        </span>
      </button>
      {open && (
        <Popover
          anchor={anchor}
          side="top"
          width={280}
          maxHeight={360}
          onDismiss={close}
          role="dialog"
          aria-label="Workspace folders"
          className="flex flex-col overflow-hidden"
        >
          <div className="min-h-0 overflow-y-auto p-1" role="listbox">
            {folders.map((folder) => {
              const selected = folder === current;
              return (
                <button
                  key={folder.path}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  title={folder.path}
                  onClick={() => void select(folder.path)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-content/5"
                >
                  <Folder className="size-3.5 shrink-0 text-content/50" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px]">
                      {folder.name}
                    </span>
                    <span className="block truncate text-[10px] text-content/40">
                      {prettyCwd(folder.path)}
                    </span>
                  </span>
                  {selected && <Check className="size-3.5" />}
                </button>
              );
            })}
          </div>
          {error && (
            <p role="alert" className="px-3 py-2 text-[11px] text-red-400">
              {error}
            </p>
          )}
        </Popover>
      )}
    </div>
  );
}
