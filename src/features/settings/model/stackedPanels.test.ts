import { describe, expect, it } from "vitest";
import { clampToolsHeight, TOOLS_HEIGHT_MIN } from "./stackedPanels";

describe("clampToolsHeight", () => {
  it("keeps room for the session list", () => {
    expect(clampToolsHeight(900, 800)).toBe(640);
  });
  it("never goes below the minimum", () => {
    expect(clampToolsHeight(10, 800)).toBe(TOOLS_HEIGHT_MIN);
    expect(clampToolsHeight(500, 100)).toBe(TOOLS_HEIGHT_MIN);
  });
});
