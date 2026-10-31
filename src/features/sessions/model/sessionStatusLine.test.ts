import { describe, expect, it } from "vitest";
import { applyHarnessEvent } from "../../../integrations/harness/core/apply";
import { costFromResult } from "../../../integrations/harness/providers/claude/claudeProtocol";
import { newSession } from "./session";
import {
  formatContextText,
  formatCost,
  formatStatusTokens,
} from "./sessionStatusLine";

describe("status line formatting", () => {
  it("formats tokens, percent and cost", () => {
    expect(formatContextText({ used: 157_800, window: 1_000_000 })).toBe(
      "157.8k tokens (16%)",
    );
    expect(formatContextText({ used: 980 })).toBe("980 tokens");
    expect(formatStatusTokens(1_200_000)).toBe("1.2M");
    expect(formatCost(5.321)).toBe("$5.32");
  });
});

describe("cost accumulation", () => {
  const spend = (seen: number, total: number) =>
    costFromResult({ total_cost_usd: total }, seen)?.delta;

  it("takes the step within one process", () => {
    expect(spend(0, 1.5)).toBe(1.5);
    expect(spend(1.5, 2)).toBeCloseTo(0.5);
  });

  it("counts a restarted process from zero instead of going negative", () => {
    expect(spend(5, 0.4)).toBe(0.4);
  });

  it("ignores results without a cost", () => {
    expect(costFromResult({}, 0)).toBeUndefined();
  });

  it("sums deltas on the session across restarts", () => {
    let session = newSession("claude", "/repo");
    for (const usd of [1.5, 0.5, 0.4]) {
      session = applyHarnessEvent(session, { type: "cost", usd });
    }
    expect(session.costUsd).toBeCloseTo(2.4);
  });
});
