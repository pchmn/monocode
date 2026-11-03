import { COMPACTED_STATUS } from "../../../../features/sessions/model/compactStatus";

/** `compact_boundary` carries the rebuilt context size; no later result reports it. */
export function compactBoundaryFromSystem(
  rec: Record<string, unknown>,
): { text: string; used?: number } | null {
  if (rec.type !== "system" || rec.subtype !== "compact_boundary") return null;
  const meta =
    rec.compact_metadata && typeof rec.compact_metadata === "object"
      ? (rec.compact_metadata as Record<string, unknown>)
      : {};
  const pre = positive(meta.pre_tokens);
  const post = positive(meta.post_tokens);
  const text =
    pre !== undefined && post !== undefined
      ? `${COMPACTED_STATUS} · ${formatTokens(pre)} → ${formatTokens(post)} tokens`
      : COMPACTED_STATUS;
  return post !== undefined ? { text, used: post } : { text };
}

function positive(value: unknown): number | undefined {
  return typeof value === "number" && value > 0 ? value : undefined;
}

function formatTokens(count: number): string {
  return count >= 1000 ? `${Math.round(count / 1000)}k` : String(count);
}
