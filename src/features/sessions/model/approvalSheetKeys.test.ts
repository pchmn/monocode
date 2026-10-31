import { describe, expect, it } from "vitest";
import { approvalSheetKeyAction } from "./approvalSheetKeys";

describe("approvalSheetKeyAction", () => {
  it("moves with wrap-around", () => {
    expect(approvalSheetKeyAction("ArrowDown", 1, 2)).toEqual({
      type: "move",
      index: 0,
    });
    expect(approvalSheetKeyAction("ArrowUp", 0, 2)).toEqual({
      type: "move",
      index: 1,
    });
  });

  it("chooses the selection on Enter and by number", () => {
    expect(approvalSheetKeyAction("Enter", 1, 2)).toEqual({
      type: "choose",
      index: 1,
    });
    expect(approvalSheetKeyAction("1", 1, 2)).toEqual({
      type: "choose",
      index: 0,
    });
    expect(approvalSheetKeyAction("3", 0, 2)).toBeNull();
  });

  // Escape already stops the running turn app-wide.
  it("ignores Escape and other keys", () => {
    expect(approvalSheetKeyAction("Escape", 0, 2)).toBeNull();
    expect(approvalSheetKeyAction("a", 0, 2)).toBeNull();
  });
});
