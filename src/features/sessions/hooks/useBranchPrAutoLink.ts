import { useEffect, useRef } from "react";
import {
  claimAutoLink,
  linkedWorkItemFromPrUrl,
  onBranchPr,
} from "../model/branchPrAutoLink";
import type { LinkedWorkItem } from "../model/session";

/** Once a session's branch has a PR, link the session to it in place of its issue. */
export function useBranchPrAutoLink(
  setLinkedWorkItem: (sessionId: string, item: LinkedWorkItem) => void,
) {
  const setRef = useRef(setLinkedWorkItem);
  setRef.current = setLinkedWorkItem;
  useEffect(
    () =>
      onBranchPr((sessionId, pr) => {
        const item = linkedWorkItemFromPrUrl(pr);
        if (item && claimAutoLink(sessionId, pr.number)) {
          setRef.current(sessionId, item);
        }
      }),
    [],
  );
}
