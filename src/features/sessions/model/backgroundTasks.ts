import { useEffect, useSyncExternalStore } from "react";
import type { Session } from "./session";

const NONE: string[] = [];
let tasksBySession = new Map<string, string[]>();
const listeners = new Set<() => void>();

// Claude only reports background tasks once its turn has yielded, so a busy
// session with tasks is an idle agent waiting on them.
export function isBackgroundOnly(
  session: Pick<Session, "busy" | "backgroundTasks"> | undefined,
): boolean {
  return !!session?.busy && !!session.backgroundTasks?.length;
}

/** Lets views that only hold a session summary see its background tasks. */
export function usePublishBackgroundTasks(sessions: readonly Session[]): void {
  useEffect(() => {
    const next = new Map<string, string[]>();
    for (const session of sessions) {
      if (isBackgroundOnly(session))
        next.set(session.id, session.backgroundTasks!);
    }
    const same =
      next.size === tasksBySession.size &&
      [...next].every(([id, tasks]) => tasksBySession.get(id) === tasks);
    if (same) return;
    tasksBySession = next;
    for (const listener of listeners) listener();
  }, [sessions]);
}

export function useSessionBackgroundTasks(sessionId: string): string[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => tasksBySession.get(sessionId) ?? NONE,
  );
}
