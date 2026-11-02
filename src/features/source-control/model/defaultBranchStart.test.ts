import { describe, expect, it } from "vitest";
import type { Session } from "../../sessions/model/session";
import {
  startsFromDefaultBranch,
  worktreeStartBase,
} from "./defaultBranchStart";

const session = (extra: Partial<Session> = {}) =>
  ({
    id: "s1",
    cwd: "/repo",
    blocks: [],
    busy: false,
    ...extra,
  }) as Session;

const start = { branch: "main", base: "origin/main" };

describe("worktreeStartBase", () => {
  it("starts an unchosen or default base from the remote default branch", () => {
    expect(worktreeStartBase(undefined, start)).toBe("origin/main");
    expect(worktreeStartBase("HEAD", start)).toBe("origin/main");
    expect(worktreeStartBase("main", start)).toBe("origin/main");
  });

  it("keeps a branch the user picked", () => {
    expect(worktreeStartBase("feat/x", start)).toBe("feat/x");
  });

  it("falls back to HEAD without a default branch", () => {
    expect(worktreeStartBase(undefined, null)).toBe("HEAD");
    expect(worktreeStartBase("main", null)).toBe("main");
  });
});

describe("startsFromDefaultBranch", () => {
  it("accepts a blank local project session", () => {
    expect(startsFromDefaultBranch(session())).toBe(true);
  });

  it("skips sessions that already have work or a working copy", () => {
    expect(
      startsFromDefaultBranch(
        session({ blocks: [{ role: "user" }] as Session["blocks"] }),
      ),
    ).toBe(false);
    expect(startsFromDefaultBranch(session({ worktreeCwd: "/repo/.wt/a" }))).toBe(false);
    expect(startsFromDefaultBranch(session({ automationId: "a1" }))).toBe(false);
    expect(startsFromDefaultBranch(session({ cwd: "~" }))).toBe(false);
  });
});
