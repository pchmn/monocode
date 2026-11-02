# Tab dividers

Top tabs and file/sub-tabs are separated Helium-style: a thin vertical divider between unplated tabs, hidden beside the selected or hovered tab and after the last one; the `+` has no plate of its own. Tabs sit 4px apart and the file-tab row is inset 3px from the left, matching its top inset. (PRs #52, #53)

## Fork files
- `src/styles/tabDividers.css` — dividers, and the 4px gap swallowed by closing/opening tabs

## Upstream hooks
- `src/main.tsx` — imports `tabDividers.css`
- `src/app/shell/TitleBar.tsx` — `data-tab-strip` and `gap-1` on the `data-title-tab-strip` row; `data-tab-strip-add` on the New session button, without `ml-0.5` nor `bg-content/4`
- `src/features/workspace/ui/SurfaceTabs.tsx` — `data-tab-strip`, `gap-1` and `pl-[3px]` on the tablist
- `src/features/workspace/ui/StackedTabs.tsx` (fork) — `data-tab-slot-id` on the session sub-tab, so it gets a divider too

## Verify
- Manual: open several top tabs and file tabs in sub-tabs mode; a divider shows between inactive tabs and before `+`, none beside the selected or hovered tab, none after the last file tab; closing a tab does not jump.
