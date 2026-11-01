import { invoke } from "@tauri-apps/api/core";
import { hasHeadlessChildBackend } from "../../core/child";

const POLL_MS = 1_000;

type Owner = { claudeSessionId: string; providerAccountId?: string };
type Chunk = { lines: string[]; offset: number };

const followers = new WeakMap<Owner, Map<string, () => void>>();

/**
 * Replays a backgrounded subagent's transcript file into `onRecord`, since
 * Claude does not stream a background run's messages. Records may repeat, so
 * `onRecord` must be idempotent.
 */
export function followClaudeSubagentLog(
  owner: Owner,
  agentId: string,
  onRecord: (rec: Record<string, unknown>) => void,
): void {
  if (hasHeadlessChildBackend()) return;
  let byAgent = followers.get(owner);
  if (!byAgent) followers.set(owner, (byAgent = new Map()));
  if (byAgent.has(agentId)) return;

  let offset = 0;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reading = Promise.resolve();
  const readOnce = async () => {
    const chunk = await invoke<Chunk>("claude_subagent_log", {
      providerSessionId: owner.claudeSessionId,
      providerAccountId: owner.providerAccountId,
      agentId,
      offset,
    }).catch(() => null);
    if (!chunk) return;
    offset = chunk.offset;
    for (const line of chunk.lines) {
      try {
        onRecord(JSON.parse(line) as Record<string, unknown>);
      } catch {
        // A malformed line must not stop the rest of the trail.
      }
    }
  };
  const read = () => (reading = reading.then(readOnce));
  const poll = async () => {
    await read();
    if (!stopped) timer = setTimeout(poll, POLL_MS);
  };
  byAgent.set(agentId, () => {
    stopped = true;
    clearTimeout(timer);
    // The last lines land just before Claude reports the run finished.
    void read();
  });
  void poll();
}

export function stopClaudeSubagentLog(owner: Owner, agentId: string): void {
  const byAgent = followers.get(owner);
  byAgent?.get(agentId)?.();
  byAgent?.delete(agentId);
}

export function stopClaudeSubagentLogs(owner: Owner): void {
  for (const agentId of [...(followers.get(owner)?.keys() ?? [])]) {
    stopClaudeSubagentLog(owner, agentId);
  }
}
