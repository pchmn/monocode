# Inactive sessions group

Sessions with no open workspace tab are grouped under a collapsible "Inactive sessions" section at the bottom of the sidebar list. (PR #3)

## Fork files
- `src/features/sessions/model/inactiveSessions.ts` — `buildSessionListWithInactive` wraps upstream `buildSessionList`
- `src/app/shell/useInactiveSessions.ts`

## Upstream hooks
- `src/app/shell/Sidebar.tsx` — `tabSessionIds` prop, `useInactiveSessions`, `buildSessionListWithInactive` in place of `buildSessionList`, `entry.kind === "inactive"` branches in the group header rendering (`isInactive`, `Archive` icon, `setInactiveCollapsed`)
- `src/features/sessions/model/sessionFolders.ts` — `"inactive"` variant of `SessionListEntry`, `INACTIVE_COLLAPSED_KEY`, exported `loadGroupCollapsed` / `saveGroupCollapsed`, `sessionListNavigationIds` treating any non-folder entry as a group
- `src/app/App.tsx` — `tabSessionIds` (`openSessionIds(tabs)`) passed to `Sidebar`
- `tests/browser/app-view-tabs.spec.ts` — "sidebar session selection" expands the inactive group before clicking a closed session

## Verify
- `src/features/sessions/model/inactiveSessions.test.ts`
- Manual: close a session's tab; it moves under "Inactive sessions" and the group collapses and expands.
