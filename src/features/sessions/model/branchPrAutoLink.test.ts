// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  branchPrSessionId,
  claimAutoLink,
  linkedWorkItemFromPrUrl,
  onBranchPr,
  reportBranchPr,
} from "./branchPrAutoLink";

describe("branchPrAutoLink", () => {
  beforeEach(() => localStorage.clear());

  it("builds a PR link from its GitHub URL", () => {
    expect(
      linkedWorkItemFromPrUrl({
        number: 280,
        url: "https://github.com/acme/app/pull/280",
      }),
    ).toEqual({
      kind: "pr",
      repo: "acme/app",
      number: 280,
      url: "https://github.com/acme/app/pull/280",
    });
    expect(
      linkedWorkItemFromPrUrl({
        number: 1,
        url: "https://gitlab.com/a/b/-/merge_requests/1",
      }),
    ).toBeNull();
  });

  it("claims each session and PR pair once", () => {
    expect(claimAutoLink("s1", 280)).toBe(true);
    expect(claimAutoLink("s1", 280)).toBe(false);
    expect(claimAutoLink("s1", 281)).toBe(true);
    expect(claimAutoLink("s2", 280)).toBe(true);
  });

  it("notifies listeners until they unsubscribe", () => {
    const listener = vi.fn();
    const off = onBranchPr(listener);
    const pr = { number: 3, url: "https://github.com/a/b/pull/3" };
    reportBranchPr("s1", pr);
    off();
    reportBranchPr("s1", pr);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("s1", pr);
  });

  describe("branchPrSessionId", () => {
    const sent = [{ id: "u1", role: "user" as const, text: "hi" }];
    const session = (extra: object) =>
      ({ id: "s1", cwd: "/repo", blocks: sent, ...extra }) as Parameters<
        typeof branchPrSessionId
      >[0];

    it("waits for the first sent message", () => {
      expect(branchPrSessionId(session({ blocks: [] }))).toBeUndefined();
      expect(
        branchPrSessionId(
          session({ blocks: [{ ...sent[0], draft: true }] }),
        ),
      ).toBeUndefined();
      expect(branchPrSessionId(session({}))).toBe("s1");
    });

    it("waits for the worktree a draft asked for", () => {
      expect(
        branchPrSessionId(session({ workspaceMode: "worktree" })),
      ).toBeUndefined();
      expect(
        branchPrSessionId(
          session({ workspaceMode: "worktree", worktreeCwd: "/wt" }),
        ),
      ).toBe("s1");
    });
  });
});
