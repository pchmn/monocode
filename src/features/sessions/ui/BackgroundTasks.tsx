import { useState, type ReactNode } from "react";
import { ChevronRight } from "../../../shared/ui/icons";
import { TerminalSpinner } from "./TerminalSpinner";

export function backgroundTasksLabel(count: number): string {
  return count === 1 ? "1 task in background" : `${count} tasks in background`;
}

export function BackgroundSpinner({ className = "" }: { className?: string }) {
  return (
    <TerminalSpinner
      className={`inline-block select-none text-center leading-none text-content/55 ${className}`}
    />
  );
}

// Cut a ring out of the icon rather than painting one: the tab sits on
// translucent window glass, so no solid colour matches it.
const DOT_GAP_MASK =
  "radial-gradient(circle 5px at calc(100% - 1px) 1px, transparent 98%, black)";

/** The agent's resting icon with a small pulsing dot in its corner. */
export function BackgroundBadge({
  tasks,
  children,
}: {
  tasks?: string[];
  children: ReactNode;
}) {
  return (
    <span
      className="relative inline-grid shrink-0 place-items-center"
      title={tasks?.join("\n")}
    >
      <span
        className="inline-grid place-items-center"
        style={{ maskImage: DOT_GAP_MASK, WebkitMaskImage: DOT_GAP_MASK }}
      >
        {children}
      </span>
      <span className="absolute -top-0.5 -right-0.5 size-1.5 animate-pulse rounded-full bg-content/75 [animation-duration:1.6s]" />
    </span>
  );
}

export function BackgroundTasksFold({ tasks }: { tasks: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="px-4 font-sans text-sm text-content/50">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-w-0 items-center gap-1.5 py-1 text-left hover:text-content/80"
      >
        <BackgroundSpinner className="w-3.5 text-[11px]" />
        <span className="truncate">{backgroundTasksLabel(tasks.length)}</span>
        <ChevronRight
          className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
          strokeWidth={1.75}
        />
      </button>
      {open ? (
        <ul className="ml-5 border-l border-stroke pl-3 pb-1">
          {tasks.map((task, i) => (
            <li
              key={i}
              className="truncate py-0.5 font-mono text-[12px] text-content/60"
              title={task}
            >
              {task}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function BackgroundStatus({ tasks }: { tasks: string[] }) {
  return (
    <span
      className="flex items-center gap-1 text-content/45"
      title={tasks.join("\n")}
    >
      <BackgroundSpinner className="w-3 text-[11px]" />
      <span>In background</span>
    </span>
  );
}
