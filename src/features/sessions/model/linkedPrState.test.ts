// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

const githubWorkItem = vi.fn();
vi.mock("../../inbox/model/githubTasks", () => ({
  githubWorkItem: (...args: unknown[]) => githubWorkItem(...args),
}));

const {
  peekLinkedPrState,
  prStateOf,
  refreshLinkedPrState,
  resetLinkedPrStatesForTest,
  setLinkedPrState,
} = await import("./linkedPrState");

const pr = {
  kind: "pr" as const,
  repo: "acme/app",
  number: 7,
  url: "https://github.com/acme/app/pull/7",
};

describe("linkedPrState", () => {
  beforeEach(() => {
    localStorage.clear();
    resetLinkedPrStatesForTest();
    githubWorkItem.mockReset();
  });

  it("maps GitHub states", () => {
    expect(prStateOf({ state: "merged", draft: false })).toBe("merged");
    expect(prStateOf({ state: "CLOSED", draft: false })).toBe("closed");
    expect(prStateOf({ state: "open", draft: true })).toBe("draft");
    expect(prStateOf({ state: "open", draft: false })).toBe("open");
  });

  it("fetches an open PR and stores its merged state across launches", async () => {
    githubWorkItem.mockResolvedValue({ state: "merged", draft: false });
    refreshLinkedPrState(pr, "/repo");
    await vi.waitFor(() => expect(peekLinkedPrState(pr)).toBe("merged"));

    resetLinkedPrStatesForTest();
    expect(peekLinkedPrState({ repo: "ACME/app", number: 7 })).toBe("merged");
    refreshLinkedPrState(pr, "/repo");
    expect(githubWorkItem).toHaveBeenCalledTimes(1);
  });

  it("does not refetch a recently fetched PR", () => {
    setLinkedPrState(pr, "open");
    refreshLinkedPrState(pr, "/repo");
    expect(githubWorkItem).not.toHaveBeenCalled();
  });

  it("refetches a recent PR when asked for a shorter max age", () => {
    githubWorkItem.mockResolvedValue({ state: "open", draft: false });
    vi.useFakeTimers();
    setLinkedPrState(pr, "open");
    vi.advanceTimersByTime(20_000);
    refreshLinkedPrState(pr, "/repo", 15_000);
    vi.useRealTimers();
    expect(githubWorkItem).toHaveBeenCalledTimes(1);
  });

  it("ignores issues", () => {
    refreshLinkedPrState({ ...pr, kind: "issue" }, "/repo");
    expect(githubWorkItem).not.toHaveBeenCalled();
  });
});
