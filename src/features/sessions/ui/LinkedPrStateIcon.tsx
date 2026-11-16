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

const LINKED_PR_STATE_LABEL: Record<LinkedPrState, string> = {
  open: "Open",
  draft: "Draft",
  merged: "Merged",
  closed: "Closed",
};

const LINKED_PR_CI_LABEL: Record<LinkedPrCi, string> = {
  pending: "CI running",
  fail: "CI failed",
  pass: "CI passed",
};

const CI_GLYPH = {
  pass: "M1.8 5.4 4.1 7.7 8.4 2.6",
  fail: "M2.6 2.6 7.4 7.4M7.4 2.6 2.6 7.4",
} as const;

// Cut out under the chip so the pulse never shows the icon through it.
const CHIP_CUTOUT =
  "radial-gradient(circle at calc(100% - 0.5px) calc(100% - 0.5px), transparent 5.2px, #000 5.7px)";

const CHIP_TINT: Record<LinkedPrCi, string> = {
  pending: "bg-amber-400/20",
  fail: "bg-red-400/20",
  pass: "bg-emerald-400/20",
};

function CiGlyph({ ci, className }: { ci: LinkedPrCi; className: string }) {
  if (ci === "pending") {
    return <span className="size-1 animate-pulse rounded-full bg-amber-400" />;
  }
  return (
    <svg
      viewBox="0 0 10 10"
      fill="none"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${className} ${ci === "pass" ? "stroke-emerald-400/90" : "stroke-red-400/85"}`}
    >
      <path d={CI_GLYPH[ci]} />
    </svg>
  );
}

function CiChip({ ci }: { ci: LinkedPrCi }) {
  return (
    <span
      className={`absolute -bottom-[3.5px] -right-[3.5px] grid size-2 place-items-center rounded-full ${CHIP_TINT[ci]}`}
    >
      <CiGlyph ci={ci} className="size-1.5" />
    </span>
  );
}

const CI_PILL_TONE: Record<LinkedPrCi, string> = {
  pending: "text-amber-400/90",
  fail: "text-red-400/85",
  pass: "text-emerald-400/90",
};

/** The CI rollup as a pill, beside the state pill of the GitHub preview card. */
export function LinkedPrCiPill({ ci }: { ci: LinkedPrCi }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-medium ${CHIP_TINT[ci]} ${CI_PILL_TONE[ci]}`}
    >
      <CiGlyph ci={ci} className="size-2" />
      {LINKED_PR_CI_LABEL[ci]}
    </span>
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

/** The PR state icon, with a chip at its corner for the CI of an open PR. */
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
        style={{ maskImage: CHIP_CUTOUT, WebkitMaskImage: CHIP_CUTOUT }}
      />
      <CiChip ci={ci} />
    </span>
  );
}

/** The sidebar badge's PR icon, tinted by the PR's state. */
export function LinkedPrBadgeContent({
  item,
  cwd,
}: {
  item: LinkedWorkItem;
  cwd: string;
}) {
  const state = useLinkedPrState(item, cwd);
  const ci = useLinkedPrCi(item);
  return (
    <span
      title={prStateTitle(state, ci)}
      className={`flex items-center gap-0.5 ${state ? LINKED_PR_STATE_TONE[state] : ""}`}
    >
      <LinkedPrStateIcon state={state} ci={ci} className="size-3" />
    </span>
  );
}
