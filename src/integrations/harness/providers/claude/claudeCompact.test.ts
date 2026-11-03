import { describe, expect, it } from "vitest";
import { compactBoundaryFromSystem } from "./claudeCompact";
import { compactionSummaryLine } from "../../../../features/sessions/model/compactStatus";
import { workSummaryLine } from "../../../../features/sessions/model/transcriptActivity";

describe("compactBoundaryFromSystem", () => {
  it("reports the rebuilt context size and the before/after in the status", () => {
    expect(
      compactBoundaryFromSystem({
        type: "system",
        subtype: "compact_boundary",
        compact_metadata: { trigger: "manual", pre_tokens: 21468, post_tokens: 5478 },
      }),
    ).toEqual({ text: "Compacted context · 21k → 5k tokens", used: 5478 });
  });

  it("falls back to a plain status without metadata", () => {
    expect(
      compactBoundaryFromSystem({ type: "system", subtype: "compact_boundary" }),
    ).toEqual({ text: "Compacted context" });
  });

  it("ignores other system records", () => {
    expect(
      compactBoundaryFromSystem({ type: "system", subtype: "status", status: "compacting" }),
    ).toBeNull();
  });
});

describe("folded compaction", () => {
  const status = (id: string, text: string) => ({ id, role: "system" as const, text });

  it("reads as its outcome instead of a generic status update", () => {
    const steps = [
      status("a", "Compacting context…"),
      status("b", "Compacted context · 21k → 5k tokens"),
    ];
    expect(compactionSummaryLine(steps)).toBe("Compacted context · 21k → 5k tokens");
    expect(workSummaryLine(steps)).toBe("Compacted context · 21k → 5k tokens");
  });

  it("keeps the generic label for other statuses", () => {
    expect(workSummaryLine([status("a", "Working on it")])).toBe("Status update");
  });
});
