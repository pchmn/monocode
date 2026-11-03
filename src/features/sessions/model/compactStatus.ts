export const COMPACTED_STATUS = "Compacted context";

/** A folded compaction reads as its outcome rather than a generic status. */
export function compactionSummaryLine(
  steps: readonly { text?: string }[],
): string | undefined {
  const last = steps[steps.length - 1]?.text?.trim();
  return last?.startsWith(COMPACTED_STATUS) ? last : undefined;
}
