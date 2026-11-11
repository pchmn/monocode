import { describe, expect, it } from "vitest";
import type { GithubWorkItem } from "../../inbox/model/githubTasks";
import { issueTokenAt, rankIssues, replaceIssueToken } from "./issueMentions";

function item(
  number: number,
  title: string,
  updatedAt: string,
  kind: GithubWorkItem["kind"] = "issue",
): GithubWorkItem {
  return {
    kind,
    number,
    title,
    url: "",
    state: "OPEN",
    updatedAt,
    labels: [],
    assignees: [],
    draft: false,
    repo: "o/r",
  };
}

describe("issueTokenAt", () => {
  it("opens on a bare # and on a typed query", () => {
    expect(issueTokenAt("fix #", 5)).toEqual({ start: 4, end: 5, query: "" });
    expect(issueTokenAt("see #12 now", 7)).toEqual({ start: 4, end: 7, query: "12" });
  });

  it("ignores hashes inside words, headings and quotes", () => {
    expect(issueTokenAt("a#1", 3)).toBeNull();
    expect(issueTokenAt("## Title", 2)).toBeNull();
    expect(issueTokenAt("# Title", 7)).toBeNull();
    expect(issueTokenAt("> #1", 4)).toBeNull();
  });
});

describe("replaceIssueToken", () => {
  it("writes #number followed by a space", () => {
    const token = issueTokenAt("fix #lo please", 7)!;
    expect(replaceIssueToken("fix #lo please", token, 42)).toEqual({
      text: "fix #42 please",
      cursor: 8,
    });
  });
});

describe("rankIssues", () => {
  const items = [
    item(12, "Login fails", "2026-01-01"),
    item(120, "Dark mode", "2026-03-01", "pr"),
    item(7, "Add login button", "2026-02-01"),
  ];

  it("lists the most recently updated first with no query", () => {
    expect(rankIssues(items, "").map((i) => i.number)).toEqual([120, 7, 12]);
  });

  it("puts number prefixes before title matches", () => {
    expect(rankIssues(items, "12").map((i) => i.number)).toEqual([12, 120]);
    const login = rankIssues(items, "login");
    expect(login.map((i) => i.number)).toEqual([7, 12]);
    expect(login[0]!.positions).toEqual([4, 5, 6, 7, 8]);
  });

  it("adds GitHub-side hits: numbers first, other matches last", () => {
    const byNumber = [item(1234, "Old crash", "2025-01-01", "pr")];
    expect(rankIssues(items, "123", byNumber).map((i) => i.number)).toEqual([1234]);
    const byText = [
      item(3, "Session expires", "2026-06-01"),
      item(7, "Add login button", "2026-02-01"),
    ];
    expect(rankIssues(items, "login", byText).map((i) => i.number)).toEqual([
      7, 12, 3,
    ]);
  });
});
