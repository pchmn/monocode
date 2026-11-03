import { COMPACTED_STATUS } from "../../../../features/sessions/model/compactStatus";
import { writeChild } from "../../core/child";
import { buildClaudeUserMessage } from "./claudeProtocol";

type RestingLive = {
  activeTurn: boolean;
  turnResultSeen: boolean;
  cancelled: boolean;
  backgroundTasks: ReadonlyMap<string, unknown>;
  manualCompaction: boolean;
  compactionConfirmed: boolean;
  compactionSettled: ((error?: Error) => void) | null;
};

/** Claude has yielded and only its background tasks keep the turn open. */
export function isRestingOnBackground(live: RestingLive): boolean {
  return (
    live.activeTurn &&
    live.turnResultSeen &&
    !live.cancelled &&
    !live.manualCompaction &&
    live.backgroundTasks.size > 0
  );
}

/**
 * Sends `/compact` into the open turn: queued behind it, it would wait for
 * background work that may never end (a dev server).
 */
export async function compactWhileResting(
  live: RestingLive,
  sessionId: string,
): Promise<void> {
  live.manualCompaction = true;
  live.compactionConfirmed = false;
  try {
    await new Promise<void>((resolve, reject) => {
      const settle = (error?: Error) => {
        live.compactionSettled = null;
        live.manualCompaction = false;
        if (error) reject(error);
        else resolve();
      };
      live.compactionSettled = settle;
      const message = buildClaudeUserMessage({ text: "/compact" });
      writeChild(sessionId, JSON.stringify(message)).catch((error: unknown) =>
        settle(error instanceof Error ? error : new Error(String(error))),
      );
    });
  } finally {
    live.compactionSettled = null;
    live.manualCompaction = false;
  }
  if (!live.compactionConfirmed && !live.cancelled) {
    throw new Error("Claude Code did not confirm context compaction");
  }
}

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
