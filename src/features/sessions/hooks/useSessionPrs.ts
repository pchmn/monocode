import { useEffect, useMemo, useSyncExternalStore } from "react";
import { claudeShellCommands } from "../../../platform/tauri/fs";
import type { LinkedWorkItem, Session } from "../model/session";
import {
  addSessionPrs,
  createdPrsFromBlocks,
  peekSessionPrs,
  prCallsMissingCommand,
  sessionWorkItems,
  subscribeSessionPrs,
} from "../model/sessionPrs";

/** The session's linked item followed by every other PR it opened. */
export function useSessionWorkItems(
  sessionId: string,
  linked: LinkedWorkItem | undefined,
): LinkedWorkItem[] {
  const prs = useSyncExternalStore(subscribeSessionPrs, () =>
    peekSessionPrs(sessionId),
  );
  return useMemo(() => sessionWorkItems(linked, prs), [linked, prs]);
}

// Full shell commands by tool call id; "" once looked up, found or not.
const commands: Record<string, string> = {};

/** Records the PRs the agent creates in this session's transcript. */
export function useCreatedPrScan(
  session: Pick<
    Session,
    "id" | "blocks" | "harness" | "providerSessionId" | "providerAccountId"
  >,
) {
  const { id, blocks, harness, providerSessionId, providerAccountId } = session;
  const created = useMemo(
    () => createdPrsFromBlocks(blocks, commands),
    [blocks],
  );
  useEffect(() => {
    if (created.length) addSessionPrs(id, created);
  }, [id, created]);

  useEffect(() => {
    if (harness !== "claude" || !providerSessionId) return;
    const missing = prCallsMissingCommand(blocks, commands);
    if (!missing.length) return;
    for (const callId of missing) commands[callId] = "";
    claudeShellCommands(providerSessionId, providerAccountId, missing)
      .then((found) => {
        Object.assign(commands, found);
        const prs = createdPrsFromBlocks(blocks, found);
        if (prs.length) addSessionPrs(id, prs);
      })
      .catch(() => undefined);
  }, [id, blocks, harness, providerSessionId, providerAccountId]);
}
