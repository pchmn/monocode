// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Block, LinkedWorkItem } from "./session";
import {
  addSessionPrs,
  createdPrsFromBlocks,
  peekSessionPrs,
  resetSessionPrsForTest,
  sessionWorkItems,
  subscribeSessionPrs,
} from "./sessionPrs";

function toolBlock(title: string, detail: string, status = "completed"): Block {
  return {
    id: title,
    role: "tool",
    text: "",
    tool: { title, detail, status },
  } as Block;
}

function pr(repo: string, number: number): LinkedWorkItem {
  return { kind: "pr", repo, number, url: `https://github.com/${repo}/pull/${number}` };
}

describe("createdPrsFromBlocks", () => {
  it("takes the PR a `gh pr create` printed, in any repo", () => {
    const blocks = [
      toolBlock(
        "cd ../helm-charts && gh pr create --title 'feat: chart' --body \"$(cat <<'EOF'",
        "Creating pull request for feat/clickhouse into main\n\nhttps://github.com/acme/helm-charts/pull/58\n",
      ),
      toolBlock("mcp__github__create_pull_request", '{"html_url":"https://github.com/acme/app/pull/912"}'),
    ];
    expect(createdPrsFromBlocks(blocks)).toEqual([pr("acme/helm-charts", 58), pr("acme/app", 912)]);
  });

  it("ignores PRs that are only read, cited, or whose creation failed", () => {
    const blocks = [
      toolBlock("gh pr view 42", "https://github.com/acme/app/pull/42"),
      toolBlock("gh pr list", "https://github.com/acme/app/pull/43"),
      toolBlock("gh pr create --fill", "a pull request already exists: https://github.com/acme/app/pull/44", "failed"),
      toolBlock("gh pr create --fill", "GraphQL: No commits between main and feat"),
      { id: "a", role: "assistant", text: "See https://github.com/acme/app/pull/45" } as Block,
    ];
    expect(createdPrsFromBlocks(blocks)).toEqual([]);
  });
});

describe("session PR store", () => {
  beforeEach(() => {
    localStorage.clear();
    resetSessionPrsForTest();
  });

  it("adds each PR once and notifies", () => {
    const listener = vi.fn();
    subscribeSessionPrs(listener);
    addSessionPrs("s1", [pr("acme/app", 1), pr("acme/app", 1)]);
    addSessionPrs("s1", [pr("Acme/App", 1), pr("acme/infra", 2)]);
    expect(peekSessionPrs("s1")).toEqual([pr("acme/app", 1), pr("acme/infra", 2)]);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("survives a reload", () => {
    addSessionPrs("s1", [pr("acme/app", 1)]);
    resetSessionPrsForTest();
    expect(peekSessionPrs("s1")).toEqual([pr("acme/app", 1)]);
  });

  it("lists the linked item first, without repeating it", () => {
    const issue: LinkedWorkItem = { kind: "issue", repo: "acme/app", number: 7, url: "https://github.com/acme/app/issues/7" };
    expect(sessionWorkItems(pr("acme/app", 1), [pr("acme/app", 1), pr("acme/infra", 2)])).toEqual([
      pr("acme/app", 1),
      pr("acme/infra", 2),
    ]);
    expect(sessionWorkItems(issue, [pr("acme/app", 1)])).toEqual([issue, pr("acme/app", 1)]);
    expect(sessionWorkItems(undefined, [])).toEqual([]);
  });
});
