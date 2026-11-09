import { describe, expect, it } from "vitest";
import { formatSteerWait, steerWaitIsLong } from "./steerWait";
import type { Block } from "./session";
import { groupTurns } from "./transcriptActivity";

describe("steer wait", () => {
  it("only flags waits of 15 seconds or more as long", () => {
    expect(steerWaitIsLong(14_999)).toBe(false);
    expect(steerWaitIsLong(15_000)).toBe(true);
  });

  it("formats seconds and minutes", () => {
    expect(formatSteerWait(42_400)).toBe("42s");
    expect(formatSteerWait(120_000)).toBe("2m");
    expect(formatSteerWait(381_000)).toBe("6m 21s");
  });
});

describe("pending steer in the transcript", () => {
  const blocks = (steerPending: boolean): Block[] => [
    { id: "u1", role: "user", text: "run ping" },
    { id: "t1", role: "tool", text: "" },
    { id: "u2", role: "user", text: "reply OK", steerPending },
  ];

  it("stays in the running turn until Claude reads it", () => {
    const ids = (turns: Block[][]) => turns.map((turn) => turn.map((b) => b.id));
    expect(ids(groupTurns(blocks(true)))).toEqual([["u1", "t1", "u2"]]);
    expect(ids(groupTurns(blocks(false)))).toEqual([["u1", "t1"], ["u2"]]);
  });
});
