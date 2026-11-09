import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { GlassBackdrop } from "../../../app/shell/GlassBackdrop";
import { isEditTool } from "../../../integrations/harness/core/preview";
import { ChevronRight, LoaderCircle, X } from "../../../shared/ui/icons";
import { FilePreview } from "../../files/ui/FilePreview";
import { ProjectMascot } from "../../projects/ui/ProjectMascot";
import type { AgentStep, Block } from "../model/session";
import {
  DETAILS_TRIGGER_ATTR,
  clampSheetHeight,
  onSubagentDetailsOpen,
  saveSheetHeight,
  savedSheetHeight,
  subagentStepCounts,
} from "../model/subagentDetail";
import {
  subagentBrief,
  subagentModelName,
  subagentName,
  subagentReport,
  toolCallLabel,
  toolCallState,
} from "../model/transcriptActivity";
import { AgentMarkdown } from "./AgentMarkdown";
import { DetailsPill } from "./DetailsPill";
import { CommandLogBody, isCommandLogBlock } from "./CommandLogSheet";
import {
  ToolDetailSession,
  ownStepBlock,
  useToolDetail,
} from "./useToolDetail";

const KEY_RESIZE_STEP = 32;

/** Opens the run's full trail in the sheet above this pane's composer. */
export function SubagentDetailsButton({ block }: { block: Block }) {
  if (!block.agentRun?.steps?.length) return null;
  return (
    <DetailsPill
      block={block}
      label="Details"
      ariaLabel={`Show details of ${subagentName(block)}`}
    />
  );
}

/**
 * A delegated run's whole trail, unfolded: every thought, message and tool
 * call with its output. Mounted in the composer dock, it rises above it.
 */
export function SubagentDetailSheet({
  blocks,
  sessionId,
  cwd,
  onOpenFile,
  onOpenDiff,
}: {
  blocks: Block[];
  sessionId?: string;
  cwd?: string;
  onOpenFile?: (path: string) => void;
  onOpenDiff?: (path: string) => void;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const [opened, setOpened] = useState<Block | null>(null);
  const [height, setHeight] = useState(0);
  const [room, setRoom] = useState(0);
  // The event carries a snapshot; the session's copy keeps it live.
  const block = opened
    ? (blocks.find((candidate) => candidate.id === opened.id) ?? opened)
    : null;
  const close = () => setOpened(null);

  const measureRoom = () => {
    const anchor = anchorRef.current;
    const pane = anchor?.closest("[data-session-drop]");
    if (!anchor || !pane) return 0;
    return (
      anchor.getBoundingClientRect().top - pane.getBoundingClientRect().top
    );
  };

  useEffect(() => {
    const pane = anchorRef.current?.closest("[data-session-drop]");
    if (!pane) return;
    return onSubagentDetailsOpen(pane, (next) => {
      const available = measureRoom();
      setRoom(available);
      setHeight((current) => current || savedSheetHeight(available));
      setOpened((current) => (current?.id === next.id ? null : next));
    });
  }, []);

  useEffect(() => {
    const pane = anchorRef.current?.closest("[data-session-drop]");
    if (!opened || !pane) return;
    const dock = anchorRef.current?.closest("[data-session-composer]");
    const observer = new ResizeObserver(() => setRoom(measureRoom()));
    observer.observe(pane);
    if (dock) observer.observe(dock);

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.isComposing) return;
      const target = event.target instanceof Node ? event.target : null;
      if (target !== document.body && !(target && pane.contains(target))) {
        return;
      }
      // Ahead of the composer's own Escape (stop, clear), which would act unseen.
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || sheetRef.current?.contains(target)) return;
      if (target.closest(`[${DETAILS_TRIGGER_ATTR}]`)) return;
      // Typing a reply about the run should not dismiss it.
      if (dock?.contains(target)) return;
      close();
    };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [opened]);

  const shown = block ? clampSheetHeight(height, room) : 0;

  return (
    <div
      ref={anchorRef}
      // Same ledge inset as ApprovalSheet, so it stacks on the composer instead of overhanging it.
      className="relative mx-[calc(0.375rem_+_var(--queue-inset)_+_var(--stack-inset,0px))] h-0 [--queue-inset:0.5rem] in-[.layout-inset]:[--queue-inset:var(--radius-xl,0.75rem)] in-[[data-session-composer]:has([data-message-queue])]:[--stack-inset:0.5rem]"
    >
      {block ? (
        <section
          ref={sheetRef}
          role="dialog"
          aria-label={
            isCommandLogBlock(block)
              ? "Command logs"
              : `Details of ${subagentName(block)}`
          }
          style={{ height: shown }}
          className="absolute inset-x-0 bottom-0 z-30 isolate flex flex-col rounded-t-[10px] in-[.layout-inset]:rounded-t-xl border border-b-0 border-content/10 shadow-[0_-2px_8px_rgba(0,0,0,0.08)]"
        >
          <GlassBackdrop />
          <ResizeHandle
            height={shown}
            room={room}
            onResize={setHeight}
            onDone={saveSheetHeight}
          />
          <ToolDetailSession.Provider value={sessionId}>
            {isCommandLogBlock(block) ? (
              <CommandLogBody
                key={block.id}
                block={block}
                blocks={blocks}
                cwd={cwd}
                onClose={close}
                onOpenFile={onOpenFile}
              />
            ) : (
              <SubagentDetailBody
                key={block.id}
                block={block}
                cwd={cwd}
                onClose={close}
                onOpenFile={onOpenFile}
                onOpenDiff={onOpenDiff}
              />
            )}
          </ToolDetailSession.Provider>
        </section>
      ) : null}
    </div>
  );
}

function ResizeHandle({
  height,
  room,
  onResize,
  onDone,
}: {
  height: number;
  room: number;
  onResize: (height: number) => void;
  onDone: (height: number) => void;
}) {
  const drag = useRef<{ y: number; height: number; last: number } | null>(null);
  const resize = (next: number) => {
    const clamped = clampSheetHeight(next, room);
    onResize(clamped);
    return clamped;
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { y: event.clientY, height, last: height };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start) return;
    start.last = resize(start.height + start.y - event.clientY);
  };
  const onPointerUp = () => {
    if (drag.current) onDone(drag.current.last);
    drag.current = null;
  };
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize details"
      aria-valuenow={height}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => onDone(resize(room))}
      onKeyDown={(event) => {
        const delta =
          event.key === "ArrowUp"
            ? KEY_RESIZE_STEP
            : event.key === "ArrowDown"
              ? -KEY_RESIZE_STEP
              : 0;
        if (!delta) return;
        event.preventDefault();
        onDone(resize(height + delta));
      }}
      className="group/handle relative z-[1] flex h-3 shrink-0 cursor-row-resize items-center justify-center rounded-t-[inherit] outline-none"
    >
      <span className="h-1 w-9 rounded-full bg-content/15 transition-colors group-hover/handle:bg-content/35 group-focus-visible/handle:bg-accent" />
    </div>
  );
}

function SubagentDetailBody({
  block,
  cwd,
  onClose,
  onOpenFile,
  onOpenDiff,
}: {
  block: Block;
  cwd?: string;
  onClose: () => void;
  onOpenFile?: (path: string) => void;
  onOpenDiff?: (path: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const steps = block.agentRun?.steps ?? [];
  const state = toolCallState(block);
  const running = state === "pending";
  const failed = state === "rejected";
  const name = subagentName(block);
  const brief = subagentBrief(block);
  const model = subagentModelName(block);
  const counts = subagentStepCounts(steps);
  const output = useToolDetail(block, true);
  const report = subagentReport(block, output.detail);
  // A run in progress is read at its newest step; a finished one from the top.
  const pinned = useRef(running);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (scroller && pinned.current) scroller.scrollTop = scroller.scrollHeight;
  }, [steps, report]);

  const status = [
    running ? "running" : failed ? "failed" : "done",
    counts.tools
      ? `${counts.tools} ${counts.tools === 1 ? "step" : "steps"}`
      : "",
    counts.failed ? `${counts.failed} failed` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="relative z-[1] flex min-h-0 flex-1 flex-col font-sans text-sm text-content">
      <header className="flex shrink-0 items-start gap-2 border-b border-content/8 px-3 pb-2">
        <span className="mt-1 flex size-4 shrink-0 items-center justify-center">
          <ProjectMascot
            project={name}
            active={running}
            className={`size-3.5 shrink-0 ${failed ? "text-red-400" : "text-content/70"}`}
          />
        </span>
        <div className="min-w-0 flex-1">
          <div
            className="line-clamp-2 text-[13px] text-content/85"
            title={brief}
          >
            {brief}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-2 text-[12px] text-content/40">
            {model ? <span>{model}</span> : null}
            {block.agentRun?.agentType ? (
              <span>{block.agentRun.agentType}</span>
            ) : null}
            <span className={failed ? "text-red-400/80" : ""}>{status}</span>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close details"
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
        <div className="flex min-w-0 flex-col gap-1.5">
          {steps.map((step) => (
            <StepRow
              key={step.id}
              step={step}
              parentId={block.id}
              cwd={cwd}
              onOpenFile={onOpenFile}
              onOpenDiff={onOpenDiff}
            />
          ))}
          {steps.length === 0 && !report ? (
            <div className="py-2 text-[12px] text-content/40">
              {running ? "Waiting for the first step…" : "No steps recorded."}
            </div>
          ) : null}
          {report ? (
            <div className="mt-1 border-t border-content/8 pt-2">
              <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-content/35">
                {failed ? "Error" : "Report"}
              </div>
              {failed ? (
                <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-5 text-red-400/80">
                  {report}
                </pre>
              ) : (
                <AgentMarkdown
                  text={report}
                  cwd={cwd}
                  onOpenFile={onOpenFile}
                />
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StepRow({
  step,
  parentId,
  cwd,
  onOpenFile,
  onOpenDiff,
}: {
  step: AgentStep;
  parentId: string;
  cwd?: string;
  onOpenFile?: (path: string) => void;
  onOpenDiff?: (path: string) => void;
}) {
  if (step.kind === "reasoning") {
    return (
      <div className="border-l-2 border-content/10 pl-2.5 text-content/50">
        <AgentMarkdown text={step.text} cwd={cwd} onOpenFile={onOpenFile} />
      </div>
    );
  }
  if (step.kind === "message") {
    return <AgentMarkdown text={step.text} cwd={cwd} onOpenFile={onOpenFile} />;
  }
  return (
    <ToolStepRow
      step={step}
      parentId={parentId}
      cwd={cwd}
      onOpenFile={onOpenFile}
      onOpenDiff={onOpenDiff}
    />
  );
}

function ToolStepRow({
  step,
  parentId,
  cwd,
  onOpenFile,
  onOpenDiff,
}: {
  step: AgentStep;
  parentId: string;
  cwd?: string;
  onOpenFile?: (path: string) => void;
  onOpenDiff?: (path: string) => void;
}) {
  const block = useMemo(() => stepToolBlock(step, parentId), [step, parentId]);
  const state = toolCallState(block);
  const failed = state === "rejected";
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? failed;
  const output = useToolDetail(block, open);
  const label = toolCallLabel(block, cwd);
  const preview = block.tool?.preview;
  const detail = output.detail?.trim();
  const expandable = output.omitted || (!!detail && detail !== label);
  const diff =
    preview && isEditTool(block.tool?.kind, block.text, preview)
      ? preview
      : null;

  const summary = (
    <>
      <span className="mt-[3px] flex size-3.5 shrink-0 items-center justify-center">
        {state === "pending" ? (
          <LoaderCircle
            className="size-3 animate-spin text-content/40"
            strokeWidth={2}
          />
        ) : expandable ? (
          <ChevronRight
            className={`size-3.5 text-content/35 transition-transform ${open ? "rotate-90" : ""}`}
            strokeWidth={1.75}
          />
        ) : (
          <span
            className={`size-1.5 rounded-full ${failed ? "bg-red-400" : "bg-content/25"}`}
          />
        )}
      </span>
      <span
        className={`min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-[12px] leading-5 ${
          failed ? "text-red-400" : "text-content/75"
        } ${open ? "" : "line-clamp-3"}`}
      >
        {label}
      </span>
    </>
  );

  return (
    <div className="flex min-w-0 flex-col">
      {expandable ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOverride(!open)}
          className="-mx-1.5 flex min-w-0 items-start gap-2 rounded-md px-1.5 py-0.5 text-left transition-colors hover:bg-content/6"
        >
          {summary}
        </button>
      ) : (
        <div className="flex min-w-0 items-start gap-2 py-0.5">{summary}</div>
      )}
      {diff ? (
        <div className="mt-1 pl-5.5">
          <FilePreview
            preview={diff}
            status={state}
            cwd={cwd}
            onOpenFile={onOpenDiff ?? onOpenFile}
          />
        </div>
      ) : null}
      {open && expandable ? (
        <pre className="mt-1 ml-5.5 max-h-80 overflow-auto rounded-md bg-content/4 px-2.5 py-1.5 font-mono text-[12px] leading-5 whitespace-pre-wrap break-words text-content/60">
          {output.pending ? "Loading output…" : detail}
        </pre>
      ) : null}
    </div>
  );
}

/** Omitted output on a step still loads, through the parent block. */
function stepToolBlock(step: AgentStep, parentId: string): Block {
  return ownStepBlock(
    {
      id: step.id,
      role: "tool",
      text: step.text,
      tool: {
        callId: step.id,
        title: step.text,
        ...(step.toolKind ? { kind: step.toolKind } : {}),
        ...(step.status ? { status: step.status } : {}),
        ...(step.detail ? { detail: step.detail } : {}),
        ...(step.detailOmitted ? { detailOmitted: true } : {}),
        ...(step.preview ? { preview: step.preview } : {}),
      },
    },
    parentId,
    step.id,
  );
}
