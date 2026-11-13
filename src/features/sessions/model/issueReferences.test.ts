import { describe, expect, it } from "vitest";
import {
  findIssueReferences,
  issueReferenceNumber,
  remarkIssueReferences,
  userMessageLinks,
} from "./issueReferences";
import { parseUserMessageLink } from "./linkPreview";

type Node = { type: string; value?: string; url?: string; children?: Node[] };

function run(children: Node[]): Node[] {
  const root: Node = {
    type: "root",
    children: [{ type: "paragraph", children }],
  };
  remarkIssueReferences()(root);
  return root.children![0]!.children!;
}

const text = (value: string): Node => ({ type: "text", value });

describe("remarkIssueReferences", () => {
  it("links each #number in prose", () => {
    const nodes = run([text("See #277 and (#12).")]);
    expect(nodes.map((n) => n.type)).toEqual([
      "text",
      "link",
      "text",
      "link",
      "text",
    ]);
    expect(issueReferenceNumber(nodes[1]!.url)).toBe(277);
    expect(nodes[1]!.children).toEqual([text("#277")]);
    expect(issueReferenceNumber(nodes[3]!.url)).toBe(12);
  });

  it("ignores hashes that are not references", () => {
    for (const value of [
      "a#12",
      "#12a",
      "##12",
      "x/#12",
      "#12-3",
      "#abc",
      "[Image #1]",
    ]) {
      expect(run([text(value)])).toEqual([text(value)]);
    }
  });

  it("leaves links and inline code alone", () => {
    const link: Node = {
      type: "link",
      url: "https://x",
      children: [text("#5")],
    };
    const code: Node = { type: "inlineCode", value: "#5" };
    expect(run([link, code])).toEqual([link, code]);
  });

  it("recurses into emphasis", () => {
    const [strong] = run([{ type: "strong", children: [text("PR #9")] }]);
    expect(strong!.children!.map((n) => n.type)).toEqual(["text", "link"]);
  });
});

describe("issueReferenceNumber", () => {
  it("only reads our own hrefs", () => {
    expect(issueReferenceNumber("#monocode-issue-42")).toBe(42);
    expect(issueReferenceNumber("#section")).toBeNull();
    expect(issueReferenceNumber(undefined)).toBeNull();
  });
});

const chip = (number: number) => ({
  url: `https://github.com/o/r/issues/${number}`,
  host: "github.com",
  displayUrl: `o/r#${number}`,
});

describe("findIssueReferences", () => {
  it("locates every #number", () => {
    expect(findIssueReferences("implemente #290 puis #291")).toEqual([
      { number: 290, index: 11, length: 4 },
      { number: 291, index: 21, length: 4 },
    ]);
  });

  it("ignores anchors, other hashes and image tokens", () => {
    expect(findIssueReferences("see a#12, ##3, #abc and [Image #1]")).toEqual(
      [],
    );
  });
});

describe("userMessageLinks", () => {
  it("makes the first resolved reference the main chip and the rest extra chips", () => {
    const text = "do #9 #122 #123 #124 now";
    const resolved = new Map([122, 123, 124].map((n) => [n, chip(n)]));
    const result = userMessageLinks(
      text,
      null,
      findIssueReferences(text),
      resolved,
    );
    expect(result?.beforeText).toBe("do #9 ");
    expect(result?.link).toBe(resolved.get(122));
    expect(result?.afterText).toBe(" #123 #124 now");
    expect(result?.afterLinks).toEqual([
      { link: resolved.get(123), index: 1, length: 4 },
      { link: resolved.get(124), index: 6, length: 4 },
    ]);
  });

  it("adds references after a URL", () => {
    const text = "see https://x.dev and #5";
    const url = parseUserMessageLink(text);
    const resolved = new Map([[5, chip(5)]]);
    const result = userMessageLinks(
      text,
      url,
      findIssueReferences(text),
      resolved,
    );
    expect(result?.link).toBe(url?.link);
    expect(result?.afterLinks).toEqual([
      { link: resolved.get(5), index: 5, length: 2 },
    ]);
  });

  it("is null without a URL or resolved reference", () => {
    const text = "#7";
    expect(
      userMessageLinks(text, null, findIssueReferences(text), new Map()),
    ).toBeNull();
  });
});
