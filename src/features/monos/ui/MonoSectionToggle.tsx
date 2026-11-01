import { ChevronDown } from "../../../shared/ui/icons";

export function MonoSectionToggle({
  collapsed,
  count,
  unseen,
  onToggle,
  className,
}: {
  collapsed: boolean;
  count: number;
  unseen: boolean;
  onToggle: () => void;
  className: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={!collapsed}
      onClick={onToggle}
      className={`${className} flex items-center gap-1.5 text-left hover:text-content/80`}
    >
      <span className="truncate">Monos</span>
      <ChevronDown
        className={`size-3 shrink-0 transition-transform motion-reduce:transition-none ${
          collapsed ? "-rotate-90" : ""
        }`}
        strokeWidth={2}
      />
      {collapsed && count ? (
        <span className="ml-auto flex items-center gap-1 text-[11px] tabular-nums">
          {unseen ? (
            <span
              aria-label="New replies"
              className="size-1.5 rounded-full bg-accent"
            />
          ) : null}
          {count}
        </span>
      ) : null}
    </button>
  );
}
