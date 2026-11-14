import { pathKey } from "../../../shared/lib/paths";
import type { HarnessAdapter } from "./registry";

export type SessionMoveBinding = {
  providerSessionId?: string;
  providerAccountId?: string;
};

type SessionMove = { cwd: string; binding: () => SessionMoveBinding | undefined };

const moves = new Map<string, SessionMove>();

/**
 * Moves a session's conversation to `cwd` before its next provider operation there.
 * Its live process keeps the old cwd until then, and resuming it from `cwd` would start over.
 */
export function moveHarnessSession(
  sessionId: string,
  cwd: string,
  binding: () => SessionMoveBinding | undefined,
): void {
  moves.set(sessionId, { cwd, binding });
}

export async function settleHarnessSessionMove(
  adapter: HarnessAdapter,
  sessionId: string,
  cwd: string,
): Promise<void> {
  const move = moves.get(sessionId);
  if (!move || pathKey(move.cwd) !== pathKey(cwd)) return;
  moves.delete(sessionId);
  const binding = move.binding();
  if (!binding?.providerSessionId) return;
  await adapter.stopSession(sessionId);
  adapter.bindSession(sessionId, binding.providerSessionId, move.cwd, binding.providerAccountId);
}
