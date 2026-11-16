import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { Block, LinkedWorkItem } from "../model/session";
import {
  addSessionPrs,
  createdPrsFromBlocks,
  peekSessionPrs,
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

/** Records the PRs the agent creates in this session's transcript. */
export function useCreatedPrScan(sessionId: string, blocks: readonly Block[]) {
  const created = useMemo(() => createdPrsFromBlocks(blocks), [blocks]);
  useEffect(() => {
    if (created.length) addSessionPrs(sessionId, created);
  }, [sessionId, created]);
}
