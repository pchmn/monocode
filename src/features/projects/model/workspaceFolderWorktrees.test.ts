import { describe, expect, it, vi } from "vitest";

const tree = (path: string, isMain = false) => ({
  path,
  branch: null,
  head: "",
  isMain,
  locked: false,
  prunable: false,
  missing: false,
  dirty: null,
  unpushed: null,
  sessionIds: [],
});

vi.mock("../../../platform/tauri/fs", () => ({
  readTextFile: async () =>
    '{ "folders": [{ "path": "api" }, { "path": "web/app" }] }',
  subscribeGitChanged: () => () => {},
  invokeWorkspace: async (_command: string, { cwd }: { cwd: string }) => ({
    defaultRoot: "",
    worktrees:
      cwd === "/me/sabri/api"
        ? [tree("/me/sabri/api", true), tree("/me/wt/api-feature")]
        : [tree("/me/sabri/web", true)],
  }),
}));

import { loadCodeWorkspace } from "./codeWorkspace";
import {
  draftWorktreeRepo,
  hasOwnWorktree,
  listCodeWorkspaceWorktrees,
  workspaceFolderBaseReset,
  workspaceFolderOf,
} from "./workspaceFolderWorktrees";

const file = "/me/sabri/sabri.code-workspace";

describe("workspace folder worktrees", () => {
  it("treat a session on a folder as having no worktree yet", async () => {
    await loadCodeWorkspace(file);
    const onFolder = { cwd: file, worktreeCwd: "/me/sabri/api" };
    expect(hasOwnWorktree(onFolder)).toBe(false);
    expect(draftWorktreeRepo(onFolder)).toBe("/me/sabri/api");
    const onTree = { cwd: file, worktreeCwd: "/me/wt/api-feature" };
    expect(hasOwnWorktree(onTree)).toBe(true);
    expect(hasOwnWorktree({ cwd: "/me/app", worktreeCwd: "/me/app-wt" })).toBe(true);
    expect(draftWorktreeRepo({ cwd: "/me/app" })).toBe("/me/app");
  });

  it("list a folder's linked worktrees only when selecting one", async () => {
    await loadCodeWorkspace(file);
    const folders = await listCodeWorkspaceWorktrees(file, "/me/sabri/api");
    expect(folders.worktrees.map((entry) => entry.path)).toEqual([
      file,
      "/me/sabri/api",
      "/me/sabri/web/app",
    ]);
    const all = await listCodeWorkspaceWorktrees(file, "/me/wt/api-feature");
    expect(all.worktrees.map((entry) => entry.path)).toContain("/me/wt/api-feature");
  });

  it("resolve a worktree back to its folder once listed", async () => {
    await loadCodeWorkspace(file);
    await listCodeWorkspaceWorktrees(file, "/me/wt/api-feature");
    expect(workspaceFolderOf(file, "/me/wt/api-feature")).toBe("/me/sabri/api");
    expect(workspaceFolderOf(file, "/me/sabri/web/app")).toBe("/me/sabri/web/app");
    expect(workspaceFolderOf("/me/app", "/me/wt/api-feature")).toBeUndefined();
  });

  it("reset the base only for a workspace draft in worktree mode", () => {
    expect(workspaceFolderBaseReset({ cwd: file, workspaceMode: "worktree" })).toEqual({
      worktreeBase: "HEAD",
    });
    expect(workspaceFolderBaseReset({ cwd: file })).toEqual({});
    expect(workspaceFolderBaseReset({ cwd: "/me/app", workspaceMode: "worktree" })).toEqual({});
  });
});
