import { invoke } from "@tauri-apps/api/core";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Terminal, X } from "../../../shared/ui/icons";
import {
  backgroundTaskId,
  redirectTarget,
  redirectedLogFile,
  taskOutputFile,
} from "../model/commandLogs";
import type { Block } from "../model/session";
import {
  DETAILS_TRIGGER_ATTR,
  openSubagentDetails,
} from "../model/subagentDetail";
import { toolCallLabel } from "../model/transcriptActivity";
import { isExpandableCommand } from "./ExpandableCommandRow";

const POLL_MS = 1_000;

type LogTail = {
  text: string | null;
  size: number;
  truncated: boolean;
  missing: boolean;
};

/** Opens a command's log file in the sheet above the composer. */
export function CommandLogsButton({ block }: { block: Block }) {
  if (!isCommandLogBlock(block)) return null;
  return (
    <button
      type="button"
      {...{ [DETAILS_TRIGGER_ATTR]: "" }}
      aria-label={`Show logs of ${toolCallLabel(block)}`}
      title="Logs"
      onClick={(event) => openSubagentDetails(event.currentTarget, block)}
      className="ml-1 flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-[12px] text-content/40 opacity-0 transition-opacity duration-200 group-hover/command:opacity-100 hover:bg-content/8 hover:text-content focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent"
    >
      <Terminal className="size-3" strokeWidth={1.75} />
      Logs
    </button>
  );
}

export function isCommandLogBlock(block: Block): boolean {
  if (!isExpandableCommand(block)) return false;
  return !!backgroundTaskId(block) || !!redirectTarget(toolCallLabel(block));
}

/** Files to read, best first: the command's own redirect, then Claude's. */
export function commandLogFiles(
  block: Block,
  blocks: readonly Block[],
  cwd?: string,
): string[] {
  const taskId = backgroundTaskId(block);
  const output = taskId
    ? taskOutputFile([block, ...blocks], taskId)
    : undefined;
  const redirect = redirectedLogFile(toolCallLabel(block), cwd);
  return [redirect, output].filter((file): file is string => !!file);
}

export function CommandLogBody({
  block,
  blocks,
  cwd,
  onClose,
  onOpenFile,
}: {
  block: Block;
  blocks: readonly Block[];
  cwd?: string;
  onClose: () => void;
  onOpenFile?: (path: string) => void;
}) {
  const command = toolCallLabel(block);
  const files = commandLogFiles(block, blocks, cwd);
  const log = useLogTail(files);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (scroller && pinned.current) scroller.scrollTop = scroller.scrollHeight;
  }, [log.text]);

  return (
    <div className="relative z-[1] flex min-h-0 flex-1 flex-col font-sans text-sm text-content">
      <header className="flex shrink-0 items-start gap-2 border-b border-content/8 px-3 pb-2">
        <Terminal
          className="mt-1 size-3.5 shrink-0 text-content/60"
          strokeWidth={1.75}
        />
        <div className="min-w-0 flex-1">
          <div
            className="line-clamp-2 font-mono text-[12px] leading-5 text-content/85"
            title={command}
          >
            {command}
          </div>
          <div className="mt-0.5 flex min-w-0 gap-x-2 text-[12px] text-content/40">
            {log.file ? (
              onOpenFile ? (
                <button
                  type="button"
                  onClick={() => onOpenFile(log.file!)}
                  className="min-w-0 truncate font-mono hover:text-content/70 hover:underline"
                  title={log.file}
                >
                  {log.file}
                </button>
              ) : (
                <span className="min-w-0 truncate font-mono" title={log.file}>
                  {log.file}
                </span>
              )
            ) : null}
            {log.truncated ? (
              <span className="shrink-0">last 512 KB</span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          aria-label="Close logs"
          title="Close (Esc)"
          onClick={onClose}
          className="grid size-7 shrink-0 place-items-center rounded-md text-content/45 transition-colors hover:bg-content/8 hover:text-content focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        >
          <X className="size-4" strokeWidth={1.75} />
        </button>
      </header>
      <div
        ref={scrollRef}
        onScroll={(event) => {
          const el = event.currentTarget;
          pinned.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2"
      >
        <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-5 text-content/70">
          {log.text ||
            (log.loading
              ? "Loading logs…"
              : log.file
                ? "No output yet."
                : "This command's log file is no longer available.")}
        </pre>
      </div>
    </div>
  );
}

/** Follows the first of `files` that exists, re-reading it as it grows. */
function useLogTail(files: string[]): {
  file?: string;
  text: string;
  truncated: boolean;
  loading: boolean;
} {
  const key = files.join("\n");
  const [state, setState] = useState<{
    key: string;
    file?: string;
    text: string;
    truncated: boolean;
    loading: boolean;
  }>({ key, text: "", truncated: false, loading: true });

  useEffect(() => {
    const candidates = key ? key.split("\n") : [];
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let size: number | undefined;
    let chosen: string | undefined;
    const poll = async () => {
      if (!chosen) {
        for (const file of candidates) {
          const tail = await readTail(file);
          if (stopped) return;
          if (!tail || tail.missing) continue;
          chosen = file;
          size = tail.size;
          setState({
            key,
            file,
            text: tail.text ?? "",
            truncated: tail.truncated,
            loading: false,
          });
          break;
        }
        if (!chosen) {
          setState({ key, text: "", truncated: false, loading: false });
        }
      } else {
        const tail = await readTail(chosen, size);
        if (stopped) return;
        if (tail && !tail.missing && tail.text !== null) {
          size = tail.size;
          setState((current) => ({
            ...current,
            text: tail.text ?? "",
            truncated: tail.truncated,
          }));
        }
      }
      if (!stopped) timer = setTimeout(poll, POLL_MS);
    };
    setState({ key, text: "", truncated: false, loading: true });
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [key]);

  return state.key === key
    ? state
    : { text: "", truncated: false, loading: true };
}

function readTail(path: string, sinceSize?: number): Promise<LogTail | null> {
  return invoke<LogTail>("read_log_tail", { path, sinceSize }).catch(
    () => null,
  );
}
