import { createPortal } from "react-dom";
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

/** The inset sidebar's search field, with the app-wide views as icons in the header. */
export function SidebarNavRow({
  iconsHost,
  search,
  items,
}: {
  iconsHost: HTMLElement | null;
  search?: { active: boolean; onClick: () => void };
  items: readonly (SidebarNavItem | false | undefined)[];
}) {
  const shown = items.filter((item): item is SidebarNavItem => !!item);
  return (
    <>
      {search ? (
        <nav aria-label="Search" className="shrink-0 px-2 pb-3 pt-1">
          <RailSearch
            label="Search"
            icon={Search}
            onClick={search.onClick}
            active={search.active}
            shortcut={`${MOD}K`}
            ariaLabel={`Search (${MOD}K)`}
          />
        </nav>
      ) : null}
      {iconsHost && shown.length
        ? createPortal(
            <nav
              aria-label="Views"
              className="flex shrink-0 items-center gap-0.5"
            >
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
          )
        : null}
    </>
  );
}
