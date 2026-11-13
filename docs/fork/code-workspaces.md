# VS Code workspaces

A `.code-workspace` file opens as one multi-folder project: one explorer tree per folder, sessions pick their folder (asked before the first send), the worktree switcher becomes a folder switcher, and the Inbox loads GitHub items for every folder's repo with a per-repo filter. Go to File searches every folder, each result's path led by its folder name. (PRs #18, #33, #34)

A session's `worktreeCwd` holds its folder until it gets a worktree of that folder's repo: when the folder is a checkout's top, the composer offers "Current checkout / New worktree" after the folder picker, and the first send branches the worktree from the folder. Changing folder in "New worktree" mode resets the base to the new repo's default branch. A worktree session is listed under its folder in the sidebar, and the Explorer shows its worktree in place of that folder. Worktrees made here are not removed on tab close (`useWorktreeCleanupOnClose` still skips workspaces).

## Fork files
- `src/features/projects/model/codeWorkspace.ts` — parsing, folder cache, `projectWorkDir`, `withWorkspaceFolder`, pending-folder state
- `src/features/projects/model/workspaceInvoke.ts` — `invoke` that runs project-keyed commands in the first folder
- `src/features/projects/ui/WorkspaceFolderTrees.tsx`, `src/features/projects/ui/WorkspaceFolderPicker.tsx`
- `src/features/inbox/model/workspaceRepos.ts` — repo list and hidden-repo filter
- `src/features/projects/model/workspaceFileIndex.ts` — Go to File index over all folders (`peekSearchFiles`, `loadSearchFiles`)
- `src/features/projects/model/workspaceFolderWorktrees.ts` — folder vs worktree (`hasOwnWorktree`, `draftWorktreeRepo`, `workspaceFolderOf`), folders' linked worktrees, `useIsCheckoutRoot`, `useFoldersInWorktree` (Explorer follows the session's worktree)

## Upstream hooks
- `src/features/files/ui/FilePicker.tsx` — `workspace` prop; `peekSearchFiles` / `loadSearchFiles` instead of `peekProjectFiles` / `loadProjectFiles`
- `src/app/App.tsx` — `workspace={sidebarCwd}` on `FilePicker`; `projectWorkDir(sidebarCwd)` for the active cwd and its fallback; `loadCodeWorkspace` effect over `recents`; `hasOwnWorktree` in `createDraftWorktree`, `draftWorktreeRepo` for `createWorktree` / `freshWorktreeBase` / `renameWorktreeBranch`; `listWorktrees(current.cwd, tree.path)` in `onWorktreeChange`
- `src/app/shell/Sidebar.tsx` — `useCodeWorkspaceFolders(cwd)`, `WorkspaceFolderTrees` (with `activeCwd={gitRoot}`) instead of the single `FileTree`, files pane query disabled when `workspaceFolders`
- `src/features/files/ui/FileTree.tsx` — `workspaceRoot` prop (root drawn as a folder row, no toolbar, depth 1)
- `src/features/projects/ui/SearchableProjectPicker.tsx` — "Open VS Code workspace…" button (`pickCodeWorkspace`)
- `src/features/sessions/model/session.ts` — `newSession` wrapped in `withWorkspaceFolder`; `sessionWorkCwd` falls back to `projectWorkDir`
- `src/features/sessions/ui/Composer.tsx` — `codeWorkspace`, `askWorkspaceFolder` before send, `WorkspaceFolderPicker` instead of the worktree picker; `folderModePicker` (`useIsCheckoutRoot`) lets the draft `WorkspacePicker` and its shortcut through
- `src/features/sessions/ui/SessionPane.tsx` — `!hasOwnWorktree(session)` in `draftWorkspace`
- `src/features/source-control/model/worktreeFocus.ts` — `inWorktreeFocus` also matches `workspaceFolderOf`
- `src/features/source-control/model/worktrees.ts` — `listWorktrees` returns `listCodeWorkspaceWorktrees`; `setWorkspaceFolderPending` and `workspaceFolderBaseReset` in `sessionInWorktree`
- `src/features/source-control/ui/SidebarWorktreeSwitcher.tsx` — `folders` / `focusFolder` labels ("All folders", "Switch folder")
- `src/features/workspace/model/tabGroups.ts` — `.code-workspace` suffix stripped in `resolveTabGroupLabel`
- `src/features/inbox/model/githubTasks.ts`, `src/features/inbox/model/githubPrChecks.ts` — `invoke` imported from `workspaceInvoke` instead of `@tauri-apps/api/core`
- `src/features/inbox/ui/InboxView.tsx` — `useHiddenInboxRepos`, `filterInboxByRepo`
- `src/features/inbox/ui/InboxFiltersMenu.tsx` — "Repositories" section (`useWorkspaceRepoFilter`)

## Verify
- `src/features/projects/model/codeWorkspace.test.ts`, `src/features/projects/model/workspaceFolderWorktrees.test.ts`, `src/features/projects/model/codeWorkspaceSession.test.ts`, `src/features/projects/model/workspaceInvoke.test.ts`, `src/features/projects/model/workspaceFileIndex.test.ts`
- Manual: open a `.code-workspace` with two folders; both trees show, a new session asks for its folder, the Inbox lists both repos' items. In a new session, pick a repo-root folder, choose "New worktree" and send: the worktree is created from that folder's default branch, the folder picker still names the folder, and the session stays listed when the sidebar is focused on that folder. The Explorer then shows that worktree's files under the folder's name (files only on the branch appear).
