import { Search, type IconComponent } from "../../shared/ui/icons";
import { MOD } from "../../platform/tauri/platform";
import { RailSearch } from "./RailAction";
import { IconButton } from "./TitleBar";

export type SidebarNavItem = {
  label: string;
  icon: IconComponent;
  shortcut?: string;
  active?: boolean;
  dot?: boolean;
  onClick: () => void;
  onOpenContextMenu?: (x: number, y: number) => void;
};

/** The inset sidebar's search and app-wide views on a single row. */
export function SidebarNavRow({
  search,
  items,
}: {
  search?: { active: boolean; onClick: () => void };
  items: readonly (SidebarNavItem | false | undefined)[];
}) {
  const shown = items.filter((item): item is SidebarNavItem => !!item);
  if (!search && !shown.length) return null;
  return (
    <nav
      aria-label="Views"
      className="flex shrink-0 items-center gap-1 px-2 pb-3 pt-1"
    >
      {search ? (
        <div className="min-w-0 flex-1">
          <RailSearch
            label="Search"
            icon={Search}
            onClick={search.onClick}
            active={search.active}
            shortcut={`${MOD}K`}
            ariaLabel={`Search (${MOD}K)`}
          />
        </div>
      ) : null}
      {shown.map(
        ({
          label,
          icon: Icon,
          shortcut,
          active,
          dot,
          onClick,
          onOpenContextMenu,
        }) => (
          <IconButton
            key={label}
            label={`${label}${dot ? ", new items" : ""}${shortcut ? ` (${shortcut})` : ""}`}
            active={active}
            onClick={onClick}
            onOpenContextMenu={onOpenContextMenu}
          >
            <span className="relative">
              <Icon className="size-3.5" strokeWidth={1.75} />
              {dot ? (
                <span
                  aria-hidden
                  className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-accent"
                />
              ) : null}
            </span>
          </IconButton>
        ),
      )}
    </nav>
  );
}
