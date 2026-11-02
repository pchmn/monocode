import { expect, it } from "vitest";
import { fileSessionRoot, worktreeHoldingBranch } from "./branchWorktree";
import type { Worktree } from "./worktrees";

const tree = (
  path: string,
  branch: string | null,
  extra: Partial<Worktree> = {},
): Worktree => ({
  path,
  branch,
  head: "abc",
  isMain: false,
  locked: false,
  prunable: false,
  missing: false,
  dirty: null,
  unpushed: null,
  sessionIds: [],
  ...extra,
});

const trees = [
  tree("/repo", "main", { isMain: true }),
  tree("/repo/.worktrees/feat", "feat/x"),
  tree("/repo/.worktrees/gone", "feat/gone", { missing: true }),
];

it("finds the other working copy that has the branch checked out", () => {
  expect(
    worktreeHoldingBranch(trees, "main", "/repo/.worktrees/feat")?.path,
  ).toBe("/repo");
  expect(worktreeHoldingBranch(trees, "feat/x", "/repo")?.path).toBe(
    "/repo/.worktrees/feat",
  );
});

it("ignores the current working copy, missing worktrees and free branches", () => {
  expect(worktreeHoldingBranch(trees, "main", "/repo")).toBeUndefined();
  expect(worktreeHoldingBranch(trees, "feat/gone", "/repo")).toBeUndefined();
  expect(worktreeHoldingBranch(trees, "feat/free", "/repo")).toBeUndefined();
  expect(worktreeHoldingBranch(undefined, "main", "/repo")).toBeUndefined();
});

it("keeps the owning project as the session cwd for a worktree file", () => {
  expect(
    fileSessionRoot(
      { cwd: "/repo/.worktrees/feat", projectCwd: "/repo" },
      "/other",
    ),
  ).toEqual({
    cwd: "/repo",
    worktreeCwd: "/repo/.worktrees/feat",
  });
  expect(fileSessionRoot({ cwd: "/repo" }, "/other")).toEqual({ cwd: "/repo" });
  expect(fileSessionRoot(undefined, "/other")).toEqual({ cwd: "/other" });
  expect(fileSessionRoot({ cwd: "" }, "/other")).toEqual({ cwd: "/other" });
});
