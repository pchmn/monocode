import { describe, expect, it } from "vitest";
import { newSession, type Block } from "../../sessions/model/session";
import {
  agentWorktreeCandidates,
  canAdoptAgentWorktree,
  pickAgentWorktree,
  worktreeAddTargets,
} from "./agentWorktree";
import type { Worktree } from "./worktrees";

const ROOT = "/Users/me/app";

function tree(path: string, extra: Partial<Worktree> = {}): Worktree {
  return {
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
  };
}

function shell(command: string, status = "completed"): Block {
  return {
    id: command,
    role: "tool",
    text: command,
    tool: { kind: "execute", status },
  };
}

describe("worktreeAddTargets", () => {
  it("resolves the path the AGENTS.md recipe creates", () => {
    expect(
      worktreeAddTargets(
        "git fetch origin && git worktree add .worktrees/demo -b feat/demo origin/main",
        ROOT,
      ),
    ).toEqual([{ path: `${ROOT}/.worktrees/demo`, raw: ".worktrees/demo" }]);
  });

  it("follows cd and git -C, and skips option values", () => {
    expect(
      worktreeAddTargets(
        "cd /Users/me/other; git -C ../app worktree add -B fix/a --lock --reason 'wip x' ../trees/a",
        ROOT,
      ),
    ).toEqual([{ path: "/Users/me/trees/a", raw: "../trees/a" }]);
  });

  it("keeps the raw path when the directory cannot be resolved", () => {
    expect(worktreeAddTargets("cd ~/code && git worktree add wt/a", ROOT)).toEqual([
      { raw: "wt/a" },
    ]);
  });

  it("ignores other worktree subcommands and quoted mentions", () => {
    expect(
      worktreeAddTargets(
        "git worktree list && git worktree remove x && echo 'git worktree add y'",
        ROOT,
      ),
    ).toEqual([]);
  });
});

describe("pickAgentWorktree", () => {
  it("prefers the latest created worktree that still exists", () => {
    const blocks = [
      shell("git worktree add .worktrees/old"),
      shell("git worktree add .worktrees/new"),
      shell("git worktree add .worktrees/failed", "failed"),
    ];
    const candidates = agentWorktreeCandidates(blocks, ROOT);
    expect(candidates.map((c) => c.raw)).toEqual([".worktrees/old", ".worktrees/new"]);
    expect(
      pickAgentWorktree(candidates, [
        tree(ROOT, { isMain: true }),
        tree(`${ROOT}/.worktrees/old`),
      ])?.path,
    ).toBe(`${ROOT}/.worktrees/old`);
    expect(
      pickAgentWorktree(candidates, [
        tree(`${ROOT}/.worktrees/old`),
        tree(`${ROOT}/.worktrees/new`),
      ])?.path,
    ).toBe(`${ROOT}/.worktrees/new`);
  });

  it("matches a symlinked root by its tail and skips missing trees", () => {
    const candidates = worktreeAddTargets("git worktree add ./wt/a/", "/tmp/repo");
    expect(pickAgentWorktree(candidates, [tree("/private/tmp/repo/wt/a")])?.path).toBe(
      "/private/tmp/repo/wt/a",
    );
    expect(
      pickAgentWorktree(candidates, [tree("/private/tmp/repo/wt/a", { missing: true })]),
    ).toBeUndefined();
  });
});

describe("canAdoptAgentWorktree", () => {
  const base = { ...newSession("claude", ROOT, "opus"), providerSessionId: "p1" };

  it("only moves idle sessions still on the project checkout", () => {
    expect(canAdoptAgentWorktree(base)).toBe(true);
    expect(canAdoptAgentWorktree({ ...base, busy: true })).toBe(false);
    expect(canAdoptAgentWorktree({ ...base, worktreeCwd: `${ROOT}/wt` })).toBe(false);
    expect(canAdoptAgentWorktree({ ...base, providerSessionId: undefined })).toBe(false);
  });

  it("skips providers that cannot resume from another cwd", () => {
    expect(canAdoptAgentWorktree({ ...base, harness: "pi" })).toBe(false);
  });
});
