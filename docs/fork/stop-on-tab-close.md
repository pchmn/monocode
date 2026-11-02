# Stop sessions when closing their tab

Setting (General, on by default): closing a session's tab stops its agent and background tasks; a busy agent asks first. (PR #28)

## Fork files
- `src/features/sessions/model/stopOnTabClose.ts` — `sessionsToStopOnClose`, `useStopSessionsOnTabClose`

## Upstream hooks
- `src/app/App.tsx` — `sessionsToStopOnClose` awaited in the three tab-close paths (single tab, several tabs, session replaced in a tab), then `stopSessionRef.current` for each
- `src/features/settings/model/settings.ts` — `stop-sessions-on-tab-close` in `SETTINGS_INDEX`
- `src/features/settings/ui/SettingsView.tsx` — the toggle row in `GeneralPage`

## Verify
- `src/features/sessions/model/stopOnTabClose.test.ts`
- Manual: close the tab of a working session; a confirmation appears and the agent stops.
