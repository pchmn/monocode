import { useEffect, useSyncExternalStore } from "react";
import type { SessionSummary } from "../data/sessionStore";

let byId = new Map<string, SessionSummary>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** App publishes the sidebar's summaries so a title tab can show its session's card. */
export function usePublishTabSessionSummaries(
  sessions: readonly SessionSummary[],
) {
  useEffect(() => {
    byId = new Map(sessions.map((session) => [session.id, session]));
    for (const listener of listeners) listener();
  }, [sessions]);
}

export function useTabSessionSummary(
  id: string | undefined,
): SessionSummary | undefined {
  return useSyncExternalStore(subscribe, () => (id ? byId.get(id) : undefined));
}
