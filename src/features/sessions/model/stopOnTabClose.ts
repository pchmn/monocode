import { useState } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import { readFlag, writeFlag } from "../../settings/model/storageFlags";
import type { Session } from "./session";

const KEY = "monocode.stopSessionsOnTabClose";

export function loadStopSessionsOnTabClose(): boolean {
  return readFlag(KEY) ?? true;
}

export function useStopSessionsOnTabClose(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(loadStopSessionsOnTabClose);
  return [
    on,
    (next) => {
      writeFlag(KEY, next);
      setOn(next);
    },
  ];
}

/**
 * The sessions to stop once these panes close, or null when the user keeps
 * the tab. An idle agent's background tasks stop silently; an agent still
 * working asks first.
 */
export async function sessionsToStopOnClose(
  sessions: readonly Session[],
  paneIds: readonly string[],
): Promise<string[] | null> {
  if (!loadStopSessionsOnTabClose()) return [];
  const closing = sessions.filter(
    (session) => session.busy && paneIds.includes(session.id),
  );
  const working = closing.filter((session) => !session.backgroundTasks?.length);
  if (working.length > 0) {
    const ok = await ask(
      working.length === 1
        ? `"${working[0].title || "This session"}" is still working. Stop it and close the tab?`
        : `${working.length} sessions are still working. Stop them and close?`,
      { title: "MonoCode", kind: "warning", okLabel: "Stop and close" },
    );
    if (!ok) return null;
  }
  return closing.map((session) => session.id);
}
