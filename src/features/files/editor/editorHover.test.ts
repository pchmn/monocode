import { describe, expect, it } from "vitest";
import { hoverMarkdown, hoverSegments } from "./editorHover";

describe("hover segments", () => {
  it("splits fenced code from its documentation", () => {
    expect(
      hoverSegments(
        "```typescript\nconst action: HprimXmlAction\n```\n\nThe **action** of `event`.",
      ),
    ).toEqual([
      { language: "typescript", code: "const action: HprimXmlAction" },
      { text: "The **action** of `event`." },
    ]);
  });

  it("keeps plain text when there is no code", () => {
    expect(hoverSegments("Just docs")).toEqual([{ text: "Just docs" }]);
  });
});

describe("hover markdown", () => {
  it("reads every hover shape", () => {
    expect(
      hoverMarkdown({
        contents: { kind: "markdown", value: "```ts\nconst a: A\n```" },
      }),
    ).toBe("```ts\nconst a: A\n```");
    expect(
      hoverMarkdown({
        contents: [{ language: "typescript", value: "type A = 1" }, "Docs"],
      }),
    ).toBe("```typescript\ntype A = 1\n```\n\nDocs");
    expect(hoverMarkdown({ contents: "" })).toBeNull();
    expect(hoverMarkdown(null)).toBeNull();
  });
});
