import { describe, expect, it } from "vitest";
import {
  agentWorktrees,
  closedSessionWorktrees,
  isRemovable,
  type CleanupCandidate,
} from "./worktreeCleanup";
import type { Worktree } from "./worktrees";

const session = (id: string, worktreeCwd?: string, busy = false) => ({
  id,
  cwd: "/repo",
  worktreeCwd,
  busy,
  worktreeRemoved: undefined,
});

const tree = (path: string, extra: Partial<Worktree> = {}): Worktree => ({
  path,
  branch: "feat/x",
  head: "abc",
  isMain: false,
  locked: false,
  prunable: false,
  missing: false,
  dirty: false,
  unpushed: 0,
  sessionIds: [],
  ...extra,
});

const ids = (...values: string[]) => new Set(values);

describe("closedSessionWorktrees", () => {
  it("offers the worktree of a closed session", () => {
    expect(
      closedSessionWorktrees(ids("a"), ids(), [session("a", "/repo-worktrees/x")]),
    ).toEqual([{ cwd: "/repo", path: "/repo-worktrees/x", origin: "session" }]);
  });

  it("keeps a worktree another open tab uses", () => {
    const sessions = [session("a", "/w/x"), session("b", "/w/x")];
    expect(closedSessionWorktrees(ids("a"), ids("b"), sessions)).toEqual([]);
  });

  it("keeps a worktree a session runs in outside any tab", () => {
    const sessions = [session("a", "/w/x"), session("b", "/w/x", true)];
    expect(closedSessionWorktrees(ids("a"), ids(), sessions)).toEqual([]);
  });

  it("ignores sessions on the main checkout", () => {
    expect(closedSessionWorktrees(ids("a"), ids(), [session("a")])).toEqual([]);
  });
});

describe("agentWorktrees", () => {
  const trees = [
    tree("/repo", { isMain: true }),
    tree("/repo/.worktrees/x"),
    tree("/repo-worktrees/y"),
    tree("/repo/.worktrees/locked", { locked: true }),
  ];

  it("offers only unlocked worktrees under .worktrees/", () => {
    expect(agentWorktrees("/repo", trees, ids(), ids("a"), [session("a")])).toEqual([
      { cwd: "/repo", path: "/repo/.worktrees/x", origin: "agent" },
    ]);
  });

  it("waits while another session of the project runs", () => {
    const sessions = [session("a"), session("b", undefined, true)];
    expect(agentWorktrees("/repo", trees, ids("b"), ids("a"), sessions)).toEqual([]);
  });
});

describe("isRemovable", () => {
  const status = { path: "/w", clean: true, integrated: true, hasCommits: false };
  const candidate = (origin: CleanupCandidate["origin"]) => ({ cwd: "/repo", path: "/w", origin });

  it("removes a clean, integrated session worktree even without commits", () => {
    expect(isRemovable(candidate("session"), status)).toBe(true);
  });

  it("keeps an agent worktree with no commit yet", () => {
    expect(isRemovable(candidate("agent"), status)).toBe(false);
    expect(isRemovable(candidate("agent"), { ...status, hasCommits: true })).toBe(true);
  });

  it("keeps dirty or unmerged worktrees", () => {
    expect(isRemovable(candidate("session"), { ...status, clean: false })).toBe(false);
    expect(isRemovable(candidate("session"), { ...status, integrated: false })).toBe(false);
  });
});
