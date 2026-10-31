import { contextPercent, type ContextUsage } from "./contextUsage";

/** 157.8k, 980, 1.2M — one decimal so the line stays comparable turn to turn. */
export function formatStatusTokens(count: number): string {
  if (!Number.isFinite(count) || count < 0) return "0";
  if (count < 1000) return String(Math.round(count));
  if (count < 1_000_000) return `${(count / 1000).toFixed(1)}k`;
  return `${(count / 1_000_000).toFixed(1)}M`;
}

export function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

/** "157.8k tokens (16%)"; the percentage drops out when the window is unknown. */
export function formatContextText(usage: ContextUsage): string {
  const percent = contextPercent(usage);
  const tokens = `${formatStatusTokens(usage.used)} tokens`;
  return percent === null ? tokens : `${tokens} (${percent}%)`;
}
