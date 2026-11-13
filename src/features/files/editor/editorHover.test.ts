import { describe, expect, it } from "vitest";
import { hoverSegments } from "./editorHover";

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
