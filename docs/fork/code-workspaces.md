# VS Code workspaces

A `.code-workspace` file opens as one multi-folder project: one explorer tree per folder, sessions pick their folder (asked before the first send), the worktree switcher becomes a folder switcher, and the Inbox loads GitHub items for every folder's repo with a per-repo filter. (PRs #18, #33, #34)

## Fork files
- `src/features/projects/model/codeWorkspace.ts` — parsing, folder cache, `projectWorkDir`, `withWorkspaceFolder`, pending-folder state
- `src/features/projects/model/workspaceInvoke.ts` — `invoke` that runs project-keyed commands in the first folder
- `src/features/projects/ui/WorkspaceFolderTrees.tsx`, `src/features/projects/ui/WorkspaceFolderPicker.tsx`
- `src/features/inbox/model/workspaceRepos.ts` — repo list and hidden-repo filter

## Upstream hooks
- `src/app/App.tsx` — `projectWorkDir(sidebarCwd)` for the active cwd and its fallback; `loadCodeWorkspace` effect over `recents`
- `src/app/shell/Sidebar.tsx` — `useCodeWorkspaceFolders(cwd)`, `WorkspaceFolderTrees` instead of the single `FileTree`, files pane query disabled when `workspaceFolders`
- `src/features/files/ui/FileTree.tsx` — `workspaceRoot` prop (root drawn as a folder row, no toolbar, depth 1)
- `src/features/projects/ui/SearchableProjectPicker.tsx` — "Open VS Code workspace…" button (`pickCodeWorkspace`)
- `src/features/sessions/model/session.ts` — `newSession` wrapped in `withWorkspaceFolder`; `sessionWorkCwd` falls back to `projectWorkDir`
- `src/features/sessions/ui/Composer.tsx` — `codeWorkspace`, `askWorkspaceFolder` before send, `WorkspaceFolderPicker` instead of the worktree picker
- `src/features/source-control/model/worktrees.ts` — `listWorktrees` returns `listCodeWorkspaceFolders`; `setWorkspaceFolderPending` in `sessionInWorktree`
- `src/features/source-control/ui/SidebarWorktreeSwitcher.tsx` — `folders` / `focusFolder` labels ("All folders", "Switch folder")
- `src/features/workspace/model/tabGroups.ts` — `.code-workspace` suffix stripped in `resolveTabGroupLabel`
- `src/features/inbox/model/githubTasks.ts`, `src/features/inbox/model/githubPrChecks.ts` — `invoke` imported from `workspaceInvoke` instead of `@tauri-apps/api/core`
- `src/features/inbox/ui/InboxView.tsx` — `useHiddenInboxRepos`, `filterInboxByRepo`
- `src/features/inbox/ui/InboxFiltersMenu.tsx` — "Repositories" section (`useWorkspaceRepoFilter`)

## Verify
- `src/features/projects/model/codeWorkspace.test.ts`, `src/features/projects/model/codeWorkspaceSession.test.ts`, `src/features/projects/model/workspaceInvoke.test.ts`
- Manual: open a `.code-workspace` with two folders; both trees show, a new session asks for its folder, the Inbox lists both repos' items.
