// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import {
  loadSwapSidePanels,
  panelsSwapped,
  resizeDirection,
  saveSwapSidePanels,
} from "./panelSide";

describe("panelSide", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to the current layout and persists the flag", () => {
    expect(loadSwapSidePanels()).toBe(false);
    saveSwapSidePanels(true);
    expect(loadSwapSidePanels()).toBe(true);
  });

  it("only swaps in the inset layout", () => {
    expect(panelsSwapped(true, false)).toBe(false);
    expect(panelsSwapped(true, true)).toBe(true);
  });

  it("mirrors resize directions when swapped", () => {
    expect(resizeDirection("sessions", false)).toBe("right");
    expect(resizeDirection("tools", false)).toBe("left");
    expect(resizeDirection("sessions", true)).toBe("left");
    expect(resizeDirection("tools", true)).toBe("right");
  });
});
