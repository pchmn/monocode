# Collapsible Monos section

The sidebar's Monos header toggles the section, showing the count and an unseen dot while collapsed. (PR #31)

## Fork files
- `src/features/monos/model/monoSectionCollapsed.ts` — `useMonoSectionCollapsed`
- `src/features/monos/ui/MonoSectionToggle.tsx`

## Upstream hooks
- `src/app/shell/MonoRailSection.tsx` — `MonoSectionToggle` replaces the "Monos" label span; `collapsed` hides the list and drops `pb-3`

## Verify
- Manual: click "Monos"; the list folds, the state survives a reload.
