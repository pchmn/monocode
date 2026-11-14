import type { RightPanelTab } from "../../features/settings/model/appearance";
import { Chatting, FileDiff, Folder, GitBranch } from "../../shared/ui/icons";

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
  onSelectTool,
  onSelectSessions,
}: {
  tab: RightPanelTab | null;
  order: readonly RightPanelTab[];
  additions: number;
  onSelectTool: (tab: RightPanelTab) => void;
  onSelectSessions: () => void;
}) {
  const active: Mode = tab ?? "sessions";
  const modes: Mode[] = ["sessions", ...order];
  return (
    <div
      role="tablist"
      aria-label="Sidebar"
      className="mx-3 mb-1 flex h-9 shrink-0 items-stretch gap-1 border-b border-stroke"
    >
      {modes.map((mode) => {
        const { label, icon: Icon } = MODES[mode];
        const selected = mode === active;
        return (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={label}
            title={selected ? undefined : label}
            data-tauri-drag-region="false"
            onClick={() => {
              if (selected) return;
              if (mode === "sessions") onSelectSessions();
              else onSelectTool(mode);
            }}
            className={`relative flex items-center gap-1.5 px-1.5 text-[12px] leading-none transition-colors duration-150 ${
              selected
                ? "text-content after:absolute after:-bottom-px after:left-1/2 after:h-0.5 after:w-5 after:-translate-x-1/2 after:rounded-full after:bg-content"
                : "text-content/50 hover:text-content"
            }`}
          >
            <Icon className="size-3.5 shrink-0" strokeWidth={1.75} />
            {selected ? <span>{label}</span> : null}
            {mode === "changes" && additions > 0 ? (
              <span className="text-[10px] font-medium tabular-nums text-diff-add-fg">
                +{additions}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
