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

// Cuts the icon under the CI badge, so the pulse never shows the icon through.
const CI_CUTOUT = "radial-gradient(circle at calc(100% - 1.5px) calc(100% - 1.5px), transparent 4.5px, #000 5px)";

function CiBadge({ ci }: { ci: LinkedPrCi }) {
  const box = "absolute -bottom-0.5 -right-0.5 size-[7px]";
  if (ci === "pending")
    return (
      <span className={`${box} grid place-items-center`}>
        <span className="size-[5px] animate-pulse rounded-full bg-amber-400" />
      </span>
    );
  return (
    <svg
      viewBox="0 0 10 10"
      fill="none"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${box} ${ci === "pass" ? "stroke-emerald-400" : "stroke-rose-500"}`}
    >
      <path d={ci === "pass" ? "M1.8 5.4 4.1 7.7 8.4 2.6" : "M2.3 2.3 7.7 7.7M7.7 2.3 2.3 7.7"} />
    </svg>
  );
}

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
  if (!ci) return <Icon className={className} strokeWidth={1.75} />;
  return (
    <span className="relative inline-flex shrink-0 align-[-2px]">
      <Icon
        className={className}
        strokeWidth={1.75}
        style={{ maskImage: CI_CUTOUT, WebkitMaskImage: CI_CUTOUT }}
      />
      <CiBadge ci={ci} />
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
