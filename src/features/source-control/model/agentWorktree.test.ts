import { describe, expect, it } from "vitest";
import { newSession, type Block } from "../../sessions/model/session";
import {
  agentWorktreeCandidates,
  canAdoptAgentWorktree,
  pickAgentWorktree,
  pickNewAgentWorktree,
  worktreeAddTargets,
  worktreeToolCount,
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

  it("follows Claude Code's EnterWorktree tool until ExitWorktree", () => {
    const enter: Block = {
      id: "enter",
      role: "tool",
      text: "Read fix/60",
      tool: {
        kind: "EnterWorktree",
        status: "completed",
        detail: `Created worktree at “${ROOT}/.worktrees/fix-60”. The session is now working in the worktree. Use ExitWorktree to leave mid-session.`,
      },
    };
    const exit: Block = {
      id: "exit",
      role: "tool",
      text: "",
      tool: { kind: "ExitWorktree", status: "completed" },
    };
    const candidates = agentWorktreeCandidates([enter], ROOT);
    expect(candidates.map((c) => c.path)).toEqual([`${ROOT}/.worktrees/fix-60`]);
    expect(pickAgentWorktree(candidates, [tree(`${ROOT}/.worktrees/fix-60`)])?.path).toBe(
      `${ROOT}/.worktrees/fix-60`,
    );
    expect(agentWorktreeCandidates([enter, exit], ROOT)).toEqual([]);
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

describe("pickNewAgentWorktree", () => {
  const SIBLING = "/Users/me/app-perf-leaner";
  const OTHER = "/Users/me/app-perf-leaner-2";
  const before = new Set([ROOT, "/Users/me/app-demo"]);
  const listed = [
    tree(ROOT, { isMain: true }),
    tree("/Users/me/app-demo"),
    tree(SIBLING),
    tree(OTHER),
  ];

  it("follows a worktree a wrapper script created and the turn then used", () => {
    const turn = [
      shell("git fetch -q origin && pnpm worktree perf/leaner 2>&1 | tail -5"),
      shell(`cd ${SIBLING} && pnpm dev`),
    ];
    expect(agentWorktreeCandidates(turn, ROOT)).toEqual([]);
    expect(pickNewAgentWorktree(before, listed, turn, new Set())?.path).toBe(SIBLING);
  });

  it("finds the path in a tool's output or edited files", () => {
    const created: Block = {
      ...shell("pnpm worktree perf/leaner"),
      tool: { kind: "execute", status: "completed", detail: `Worktree ready: ${OTHER}\n` },
    };
    expect(pickNewAgentWorktree(before, listed, [created], new Set())?.path).toBe(OTHER);
    const edit: Block = {
      id: "edit",
      role: "tool",
      text: "Edit read-tool.ts",
      tool: { kind: "edit", status: "completed", paths: [`${SIBLING}/src/read-tool.ts`] },
    };
    expect(pickNewAgentWorktree(before, listed, [edit], new Set())?.path).toBe(SIBLING);
  });

  it("ignores worktrees that existed before the turn, belong to another session or go unmentioned", () => {
    const turn = [shell("cd /Users/me/app-demo && git log -1")];
    expect(pickNewAgentWorktree(before, listed, turn, new Set())).toBeUndefined();
    const used = [shell(`cd ${SIBLING} && pnpm dev`)];
    expect(pickNewAgentWorktree(before, listed, used, new Set([SIBLING]))).toBeUndefined();
    expect(pickNewAgentWorktree(before, listed, [shell("pnpm worktree x")], new Set())).toBeUndefined();
  });

  it("does not take a path for a longer sibling's prefix", () => {
    const turn = [shell(`cd ${OTHER} && pnpm dev`)];
    const onlySibling = listed.filter((entry) => entry.path !== OTHER);
    expect(pickNewAgentWorktree(before, onlySibling, turn, new Set())).toBeUndefined();
  });
});

describe("canAdoptAgentWorktree", () => {
  const base = newSession("claude", ROOT, "opus");

  it("moves sessions still on the project checkout, mid-turn included", () => {
    expect(canAdoptAgentWorktree(base)).toBe(true);
    expect(canAdoptAgentWorktree({ ...base, busy: true })).toBe(true);
    expect(canAdoptAgentWorktree({ ...base, worktreeCwd: `${ROOT}/wt` })).toBe(false);
  });

  it("skips providers that cannot resume from another cwd", () => {
    expect(canAdoptAgentWorktree({ ...base, harness: "pi" })).toBe(false);
  });
});

describe("worktreeToolCount", () => {
  it("counts finished tool calls that mention a worktree", () => {
    const blocks = [
      shell("git worktree add .worktrees/x -b feat/x"),
      shell("pnpm worktree feat/y"),
      shell("pnpm test"),
      shell("git worktree add .worktrees/z", "running"),
    ];
    expect(worktreeToolCount(blocks)).toBe(2);
  });
});
