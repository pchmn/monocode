import { contextPercent, type ContextUsage } from "./contextUsage";

/** 158k, 980, 1.2M. */
export function formatStatusTokens(count: number): string {
  if (!Number.isFinite(count) || count < 0) return "0";
  if (count < 1000) return String(Math.round(count));
  if (count < 999_500) return `${Math.round(count / 1000)}k`;
  return `${(count / 1_000_000).toFixed(1)}M`;
}

export function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

/** "158k tokens (16%)"; the percentage drops out when the window is unknown. */
export function formatContextText(usage: ContextUsage): string {
  const percent = contextPercent(usage);
  const tokens = `${formatStatusTokens(usage.used)} tokens`;
  return percent === null ? tokens : `${tokens} (${percent}%)`;
}
