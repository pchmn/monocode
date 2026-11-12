import { describe, expect, it } from "vitest";
import { issueReferenceNumber, remarkIssueReferences } from "./issueReferences";

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
    for (const value of ["a#12", "#12a", "##12", "x/#12", "#12-3", "#abc"]) {
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
