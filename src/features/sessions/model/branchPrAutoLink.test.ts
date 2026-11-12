// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
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
});
