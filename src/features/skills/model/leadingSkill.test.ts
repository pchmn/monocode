import { describe, expect, it } from "vitest";
import { splitLeadingSkill } from "./leadingSkill";

describe("splitLeadingSkill", () => {
  it("splits the invoked skill off the start of a message", () => {
    expect(splitLeadingSkill("/triage issue 309")).toEqual({
      lead: "",
      skill: "/triage",
      rest: " issue 309",
    });
    expect(splitLeadingSkill("/plugin:review-pr")).toEqual({
      lead: "",
      skill: "/plugin:review-pr",
      rest: "",
    });
  });

  it("ignores paths and slashes later in the message", () => {
    expect(splitLeadingSkill("/tmp/log is empty")).toBeNull();
    expect(splitLeadingSkill("run /triage")).toBeNull();
    expect(splitLeadingSkill("/Triage")).toBeNull();
  });
});
