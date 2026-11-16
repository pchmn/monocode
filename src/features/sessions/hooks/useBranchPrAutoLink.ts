import { useEffect, useRef } from "react";
import {
  claimAutoLink,
  linkedWorkItemFromPrUrl,
  onBranchPr,
} from "../model/branchPrAutoLink";
import type { LinkedWorkItem } from "../model/session";
import { addSessionPrs } from "../model/sessionPrs";

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
        // Kept in the session's PR list even once the link moves to an issue.
        if (item) addSessionPrs(sessionId, [item]);
        if (item && claimAutoLink(sessionId, pr.number)) {
          setRef.current(sessionId, item);
        }
      }),
    [],
  );
}
