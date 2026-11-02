import { createPortal } from "react-dom";
import { Search, type IconComponent } from "../../shared/ui/icons";
import { MOD } from "../../platform/tauri/platform";
import { RailAction, RailSearch } from "./RailAction";
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

/** The inset sidebar's search and app-wide views: icons in the project header when stacked, rows otherwise. */
export function SidebarNavRow({
  stacked,
  iconsHost,
  search,
  items,
}: {
  stacked: boolean;
  iconsHost: HTMLElement | null;
  search?: { active: boolean; onClick: () => void };
  items: readonly (SidebarNavItem | false | undefined)[];
}) {
  if (!stacked) return <SidebarNavList search={search} items={items} />;
  const shown = [
    search && {
      label: "Search",
      icon: Search,
      shortcut: `${MOD}K`,
      active: search.active,
      onClick: search.onClick,
    },
    ...items,
  ].filter((item): item is SidebarNavItem => !!item);
  if (!iconsHost || !shown.length) return null;
  return createPortal(
    <nav aria-label="Views" className="flex shrink-0 items-center gap-0.5">
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
    </nav>,
    iconsHost,
  );
}

function SidebarNavList({
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
      className="flex shrink-0 flex-col gap-px px-2 pb-3 pt-1"
    >
      {search ? (
        <>
          <RailSearch
            label="Search"
            icon={Search}
            onClick={search.onClick}
            active={search.active}
            shortcut={`${MOD}K`}
            ariaLabel={`Search (${MOD}K)`}
          />
          <div className="mt-0.5" />
        </>
      ) : null}
      {shown.map(
        ({
          label,
          icon,
          shortcut,
          active,
          dot,
          onClick,
          onOpenContextMenu,
        }) => (
          <RailAction
            key={label}
            label={label}
            icon={icon}
            shortcut={shortcut}
            active={active}
            dot={dot}
            ariaLabel={dot ? `${label}, new items` : undefined}
            onClick={onClick}
            onOpenContextMenu={onOpenContextMenu}
          />
        ),
      )}
    </nav>
  );
}
