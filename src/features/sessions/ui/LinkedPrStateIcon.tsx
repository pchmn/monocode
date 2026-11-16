import { useEffect, useSyncExternalStore } from "react";
import {
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
} from "../../../shared/ui/icons";
import {
  LINKED_PR_CI_PENDING_MS,
  LINKED_PR_REFRESH_MS,
  peekLinkedPrCi,
  peekLinkedPrState,
  refreshLinkedPrState,
  subscribeLinkedPrStates,
  type LinkedPrCi,
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
  const ciPending = useLinkedPrCi(item) === "pending";
  const { kind, repo, number, url } = item;
  useEffect(() => {
    if (kind !== "pr" || state === "merged") return;
    const target: LinkedWorkItem = { kind, repo, number, url };
    refreshLinkedPrState(target, cwd, maxAgeMs);
    const every = ciPending ? LINKED_PR_CI_PENDING_MS : LINKED_PR_REFRESH_MS;
    const timer = window.setInterval(
      () => refreshLinkedPrState(target, cwd, every),
      every,
    );
    return () => window.clearInterval(timer);
  }, [kind, repo, number, url, cwd, state, maxAgeMs, ciPending]);
  return state;
}

export function useLinkedPrCi(item: LinkedWorkItem): LinkedPrCi | null {
  return useSyncExternalStore(subscribeLinkedPrStates, () =>
    item.kind === "pr" ? peekLinkedPrCi(item) : null,
  );
}

export const LINKED_PR_STATE_TONE: Record<LinkedPrState, string> = {
  open: "text-emerald-400/90",
  draft: "text-content/45",
  merged: "text-violet-400/90",
  closed: "text-rose-400/90",
};

export const LINKED_PR_STATE_LABEL: Record<LinkedPrState, string> = {
  open: "Open",
  draft: "Draft",
  merged: "Merged",
  closed: "Closed",
};

export const LINKED_PR_CI_LABEL: Record<LinkedPrCi, string> = {
  pending: "CI running",
  fail: "CI failed",
  pass: "CI passed",
};

const CI_DOT: Record<LinkedPrCi, string> = {
  pending: "bg-amber-400 animate-pulse",
  fail: "bg-rose-500",
  pass: "bg-emerald-400",
};

const STATE_ICON = {
  open: GitPullRequest,
  draft: GitPullRequestDraft,
  merged: GitMerge,
  closed: GitPullRequestClosed,
};

export function prStateTitle(state: LinkedPrState | null, ci: LinkedPrCi | null) {
  const parts = [state && LINKED_PR_STATE_LABEL[state], ci && LINKED_PR_CI_LABEL[ci]];
  return parts.filter(Boolean).join(" · ") || undefined;
}

/** The PR state icon, with a dot at its corner for the CI of an open PR. */
export function LinkedPrStateIcon({
  state,
  ci = null,
  className,
}: {
  state: LinkedPrState | null;
  ci?: LinkedPrCi | null;
  className?: string;
}) {
  const Icon = state ? STATE_ICON[state] : GitPullRequest;
  const icon = <Icon className={className} strokeWidth={1.75} />;
  if (!ci) return icon;
  return (
    <span className="relative inline-flex shrink-0 align-[-2px]">
      {icon}
      <span
        className={`absolute -bottom-px -right-px size-[5px] rounded-full ${CI_DOT[ci]}`}
      />
    </span>
  );
}

/** The sidebar badge's PR icon and number, tinted by the PR's state. */
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
  const ci = useLinkedPrCi(item);
  return (
    <span
      title={prStateTitle(state, ci)}
      className={`flex items-center gap-0.5 ${state ? LINKED_PR_STATE_TONE[state] : ""}`}
    >
      <LinkedPrStateIcon state={state} ci={ci} className="size-3" />
      {dense ? null : <span>#{item.number}</span>}
    </span>
  );
}
