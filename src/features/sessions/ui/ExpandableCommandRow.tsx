import { useState, type ReactNode } from "react";
import { ChevronRight } from "../../../shared/ui/icons";
import { isExecuteTool } from "../../../integrations/harness/core/preview";
import type { Block } from "../model/session";
import { CommandLogsButton } from "./CommandLogSheet";
import { useToolDetail } from "./useToolDetail";

export function isExpandableCommand(block: Block): boolean {
  return isExecuteTool(block.tool?.kind, block.text || block.tool?.title);
}

/** A shell command row that opens onto the whole command and its output. */
export function ExpandableCommandRow({
  block,
  label,
  icon,
}: {
  block: Block;
  label: string;
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const stored = useToolDetail(block, open);
  const output = stored.pending ? "Loading output…" : stored.detail?.trim();

  return (
    <div className="flex min-w-0 flex-col">
      <div className="group/command flex min-w-0 items-center">
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${open ? "Hide" : "Show"} command details for ${label}`}
          onClick={() => setOpen((value) => !value)}
          className="group flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left"
        >
          {icon}
          <span
            className="min-w-0 flex-1 truncate font-mono text-[13px] text-content/65 group-hover:text-content/85"
            title={label}
          >
            {label}
          </span>
          <ChevronRight
            className={`size-3.5 shrink-0 text-content/35 transition-transform ${
              open ? "rotate-90" : "opacity-0 group-hover:opacity-100"
            }`}
            strokeWidth={1.75}
          />
        </button>
        <CommandLogsButton block={block} />
      </div>
      {open ? (
        <div className="mb-1 min-w-0 overflow-hidden rounded-md bg-content/4 font-mono text-[12px] leading-5">
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all px-2.5 py-1.5 text-content/80">
            <span className="select-none text-content/35">$ </span>
            {label}
          </pre>
          {output && output !== label ? (
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words border-t border-content/6 px-2.5 py-1.5 text-content/55">
              {output}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
