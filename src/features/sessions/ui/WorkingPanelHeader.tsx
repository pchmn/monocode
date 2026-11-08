import { ChevronDown } from "../../../shared/ui/icons";

export function WorkingPanelHeader({
  collapsed,
  count,
  needsApproval,
  onToggle,
}: {
  collapsed: boolean;
  count: number;
  needsApproval: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={!collapsed}
      onClick={onToggle}
      className="group flex w-full items-center gap-2 px-3.5 py-1.5 text-left hover:bg-content/5"
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)] motion-safe:animate-pulse"
      />
      <span className="truncate text-xs text-content/50 group-hover:text-content/80">
        Working
      </span>
      <ChevronDown
        className={`size-3 shrink-0 text-content/40 transition-transform motion-reduce:transition-none ${
          collapsed ? "-rotate-90" : ""
        }`}
        strokeWidth={2}
      />
      <span className="ml-auto flex items-center gap-1.5 text-[11px] tabular-nums text-content/40">
        {collapsed && needsApproval ? (
          <span
            aria-label="Needs approval"
            className="size-1.5 rounded-full bg-amber-400"
          />
        ) : null}
        {count}
      </span>
    </button>
  );
}
