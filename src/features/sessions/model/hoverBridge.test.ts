import { describe, expect, it } from "vitest";
import { inHoverBridge } from "./hoverBridge";

const tab = { left: 100, right: 300, top: 0, bottom: 30 };
const card = { left: 100, right: 360, top: 38, bottom: 238 };

describe("inHoverBridge", () => {
  it("covers the trigger, the card and the gap between them", () => {
    expect(inHoverBridge(150, 10, tab, card)).toBe(true);
    expect(inHoverBridge(340, 100, tab, card)).toBe(true);
    expect(inHoverBridge(200, 34, tab, card)).toBe(true);
  });

  it("excludes the gap beside the trigger", () => {
    expect(inHoverBridge(330, 34, tab, card)).toBe(false);
    expect(inHoverBridge(50, 34, tab, card)).toBe(false);
  });

  it("excludes points past both", () => {
    expect(inHoverBridge(200, 260, tab, card)).toBe(false);
  });
});
