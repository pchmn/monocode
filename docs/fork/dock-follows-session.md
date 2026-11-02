# Dock follows the session

While the project terminal dock is open, it shows a terminal in the active session's folder (workspace folder or worktree): switching sessions, or picking another folder, selects the terminal opened there, or opens one when none is. Other terminals stay open in the dock.

## Fork files
- `src/features/terminal/model/dockFollow.ts` — matches terminals on the folder they were opened in, so a `cd` does not detach them
- `src/features/terminal/hooks/useDockFollowsSession.ts`

## Upstream hooks
- `src/app/App.tsx` — `useDockFollowsSession(projectCwd, active, projectTerminals, setProjectTerminals)`, after `useDefaultBranchOnOpen`

## Verify
- `src/features/terminal/model/dockFollow.test.ts`
- Manual: in a VS Code workspace, open the dock from a session on the first folder, then start a session and pick another folder: the dock adds and selects a terminal in that folder; switching back to the first session reselects its terminal.
