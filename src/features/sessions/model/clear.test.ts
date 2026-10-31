import { describe, expect, it } from "vitest";
import { isClearCommand } from "./clear";

describe("clear command", () => {
  it("matches a standalone /clear command", () => {
    expect(isClearCommand("/clear")).toBe(true);
    expect(isClearCommand("  /CLEAR\n")).toBe(true);
  });

  it("does not consume ordinary prompt text", () => {
    expect(isClearCommand("/clear now")).toBe(false);
    expect(isClearCommand("mention /clear in docs")).toBe(false);
    expect(isClearCommand("/clearance")).toBe(false);
  });
});
