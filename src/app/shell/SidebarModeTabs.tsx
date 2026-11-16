import type { RightPanelTab } from "../../features/settings/model/appearance";
import { Chatting, FileDiff, Folder, GitBranch } from "../../shared/ui/icons";
import { useRailTooltip } from "./RailTooltip";

const MODES = {
  sessions: { label: "Sessions", icon: Chatting },
  files: { label: "Files", icon: Folder },
  changes: { label: "Changes", icon: FileDiff },
  graph: { label: "History", icon: GitBranch },
} as const;

type Mode = keyof typeof MODES;

/** Stacked side panels: the sidebar shows either the sessions or one project tool. */
export function SidebarModeTabs({
  tab,
  order,
  additions,
  changedFiles,
  sessionsNeedYou,
  onSelectTool,
  onSelectSessions,
}: {
  tab: RightPanelTab | null;
  order: readonly RightPanelTab[];
  additions: number;
  changedFiles: number;
  sessionsNeedYou: boolean;
  onSelectTool: (tab: RightPanelTab) => void;
  onSelectSessions: () => void;
}) {
  const active: Mode = tab ?? "sessions";
  const modes: Mode[] = ["sessions", ...order];
  const { handlers, tooltip } = useRailTooltip("bottom");
  return (
    <div
      role="tablist"
      aria-label="Sidebar"
      className="mx-2.5 mb-1 flex h-10 shrink-0 items-center gap-1 border-b border-stroke"
      {...handlers}
    >
      {modes.map((mode) => {
        const { label, icon: Icon } = MODES[mode];
        const selected = mode === active;
        const needsYou = mode === "sessions" && sessionsNeedYou;
        const changes = mode === "changes" ? changedFiles : 0;
        return (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={label}
            data-rail-tip={selected ? undefined : label}
            data-rail-tip-detail={needsYou ? "Needs you" : undefined}
            data-rail-tip-additions={mode === "changes" ? additions : undefined}
            data-tauri-drag-region="false"
            onClick={() => {
              if (selected) return;
              if (mode === "sessions") onSelectSessions();
              else onSelectTool(mode);
            }}
            className={`relative flex h-7 items-center rounded-md px-1.5 text-[12px] font-medium leading-none transition-colors duration-150 active:scale-[0.97] ${
              selected
                ? "bg-selection-strong text-content"
                : "text-content/45 hover:bg-selection-subtle hover:text-content/80"
            }`}
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.75} />
            {/* 0fr → 1fr animates the label's width without measuring it. */}
            <span
              className={`grid transition-[grid-template-columns,opacity] duration-200 ease-[var(--motion-ease-out)] motion-reduce:transition-none ${
                selected ? "grid-cols-[1fr] opacity-100" : "grid-cols-[0fr] opacity-0"
              }`}
            >
              <span className="min-w-0 overflow-hidden">
                <span className="flex items-center gap-1.5 whitespace-nowrap pl-1.5 pr-0.5">
                  {label}
                  {mode === "changes" && additions > 0 ? (
                    <span className="text-[10px] tabular-nums text-diff-add-fg">
                      +{additions}
                    </span>
                  ) : null}
                </span>
              </span>
            </span>
            {!selected && needsYou ? (
              <span className="absolute right-0.5 top-0.5 size-[7px] rounded-full bg-amber-400" />
            ) : null}
            {!selected && changes > 0 ? (
              <span className="absolute -right-1 -top-0.5 text-[9px] font-semibold tabular-nums text-diff-add-fg">
                {changes}
              </span>
            ) : null}
          </button>
        );
      })}
      {tooltip}
    </div>
  );
}
