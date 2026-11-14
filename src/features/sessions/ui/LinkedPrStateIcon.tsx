import { useEffect, useSyncExternalStore } from "react";
import {
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
} from "../../../shared/ui/icons";
import {
  LINKED_PR_REFRESH_MS,
  peekLinkedPrState,
  refreshLinkedPrState,
  subscribeLinkedPrStates,
  type LinkedPrState,
} from "../model/linkedPrState";
import type { LinkedWorkItem } from "../model/session";

/** `maxAgeMs` bounds the first fetch's staleness; later ones follow the 3-minute cadence. */
export function useLinkedPrState(
  item: LinkedWorkItem,
  cwd: string,
  maxAgeMs?: number,
): LinkedPrState | null {
  const state = useSyncExternalStore(subscribeLinkedPrStates, () =>
    item.kind === "pr" ? peekLinkedPrState(item) : null,
  );
  const { kind, repo, number, url } = item;
  useEffect(() => {
    if (kind !== "pr" || state === "merged") return;
    const target: LinkedWorkItem = { kind, repo, number, url };
    refreshLinkedPrState(target, cwd, maxAgeMs);
    const timer = window.setInterval(
      () => refreshLinkedPrState(target, cwd),
      LINKED_PR_REFRESH_MS,
    );
    return () => window.clearInterval(timer);
  }, [kind, repo, number, url, cwd, state, maxAgeMs]);
  return state;
}

export const LINKED_PR_STATE_TONE: Partial<Record<LinkedPrState, string>> = {
  merged: "text-violet-400/90",
  closed: "text-rose-400/90",
};

export const LINKED_PR_STATE_LABEL: Partial<Record<LinkedPrState, string>> = {
  merged: "Merged",
  closed: "Closed",
};

export function LinkedPrStateIcon({
  state,
  className,
}: {
  state: LinkedPrState | null;
  className?: string;
}) {
  const Icon =
    state === "merged"
      ? GitMerge
      : state === "closed"
        ? GitPullRequestClosed
        : GitPullRequest;
  return <Icon className={className} strokeWidth={1.75} />;
}

/** The sidebar badge's PR icon and number, tinted once the PR is merged or closed. */
export function LinkedPrBadgeContent({
  item,
  cwd,
  dense,
}: {
  item: LinkedWorkItem;
  cwd: string;
  dense?: boolean;
}) {
  const state = useLinkedPrState(item, cwd);
  return (
    <span
      title={state ? LINKED_PR_STATE_LABEL[state] : undefined}
      className={`flex items-center gap-0.5 ${(state && LINKED_PR_STATE_TONE[state]) ?? ""}`}
    >
      <LinkedPrStateIcon state={state} className="size-3" />
      {dense ? null : <span>#{item.number}</span>}
    </span>
  );
}
