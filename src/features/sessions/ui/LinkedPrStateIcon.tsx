import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import {
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
} from "../../../shared/ui/icons";
import {
  LINKED_PR_CI_PENDING_MS,
  LINKED_PR_ON_DEMAND_MS,
  LINKED_PR_REFRESH_MS,
  peekLinkedPrCi,
  peekLinkedPrConflicts,
  peekLinkedPrState,
  refreshLinkedPrState,
  subscribeLinkedPrStates,
  type LinkedPrCi,
  type LinkedPrState,
} from "../model/linkedPrState";
import type { LinkedWorkItem } from "../model/session";
import { useSessionWorkItems } from "../hooks/useSessionPrs";

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
    const onFocus = () =>
      refreshLinkedPrState(target, cwd, LINKED_PR_ON_DEMAND_MS);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [kind, repo, number, url, cwd, state, maxAgeMs, ciPending]);
  return state;
}

export function useLinkedPrCi(item: LinkedWorkItem): LinkedPrCi | null {
  return useSyncExternalStore(subscribeLinkedPrStates, () =>
    item.kind === "pr" ? peekLinkedPrCi(item) : null,
  );
}

export function useLinkedPrConflicts(item: LinkedWorkItem): boolean {
  return useSyncExternalStore(subscribeLinkedPrStates, () =>
    item.kind === "pr" ? peekLinkedPrConflicts(item) : false,
  );
}

const LINKED_PR_STATE_TONE: Record<LinkedPrState, string> = {
  open: "text-emerald-400/90",
  draft: "text-content/45",
  merged: "text-violet-400/90",
  closed: "text-rose-400/90",
};

// Before the first fetch, so a fresh PR never flashes in the accent colour.
export function linkedPrStateTone(state: LinkedPrState | null) {
  return state ? LINKED_PR_STATE_TONE[state] : "text-content/50";
}

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

const CONFLICT_GLYPH = "M5 2.2v3.2M5 7.8v.01";

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

function ConflictGlyph({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 10 10"
      fill="none"
      strokeWidth={2.2}
      strokeLinecap="round"
      className={`${className} stroke-red-400/85`}
    >
      <path d={CONFLICT_GLYPH} />
    </svg>
  );
}

// Conflicts take the chip over CI: the PR cannot merge until they are resolved.
function CiChip({ ci, conflicts }: { ci: LinkedPrCi | null; conflicts: boolean }) {
  const tint = conflicts || !ci ? "bg-red-400/20" : CHIP_TINT[ci];
  return (
    <span
      className={`absolute -bottom-[3.5px] -right-[3.5px] grid size-2 place-items-center rounded-full ${tint}`}
    >
      {conflicts || !ci ? (
        <ConflictGlyph className="size-1.5" />
      ) : (
        <CiGlyph ci={ci} className="size-1.5" />
      )}
    </span>
  );
}

const CI_PILL_TONE: Record<LinkedPrCi, string> = {
  pending: "text-amber-400/90",
  fail: "text-red-400/85",
  pass: "text-emerald-400/90",
};

const CI_PILL_VALUE: Record<LinkedPrCi, string> = {
  pending: "running",
  fail: "failed",
  pass: "passed",
};

export function LinkedPrCiPill({ ci }: { ci: LinkedPrCi }) {
  return (
    <LinkedStatusPill label="CI" className={`${CHIP_TINT[ci]} ${CI_PILL_TONE[ci]}`}>
      <CiGlyph ci={ci} className="size-2" />
      {CI_PILL_VALUE[ci]}
    </LinkedStatusPill>
  );
}

/** A tinted pill that names what it measures, so it never reads as a GitHub label. */
export function LinkedStatusPill({
  label,
  className,
  children,
}: {
  label: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-[7px] py-px text-[10px] font-medium ${className}`}
    >
      <span className="font-normal opacity-60">{label}</span>
      {children}
    </span>
  );
}

const STATE_ICON = {
  open: GitPullRequest,
  draft: GitPullRequestDraft,
  merged: GitMerge,
  closed: GitPullRequestClosed,
};

export function prStateTitle(
  state: LinkedPrState | null,
  ci: LinkedPrCi | null,
  conflicts = false,
) {
  const parts = [
    state && LINKED_PR_STATE_LABEL[state],
    conflicts && "Merge conflicts",
    ci && LINKED_PR_CI_LABEL[ci],
  ];
  return parts.filter(Boolean).join(" · ") || undefined;
}

/** The PR state icon, with a chip at its corner for the CI or merge conflicts of an open PR. */
export function LinkedPrStateIcon({
  state,
  ci = null,
  conflicts = false,
  className,
}: {
  state: LinkedPrState | null;
  ci?: LinkedPrCi | null;
  conflicts?: boolean;
  className?: string;
}) {
  const Icon = state ? STATE_ICON[state] : GitPullRequest;
  if (!ci && !conflicts) return <Icon className={className} strokeWidth={1.75} />;
  return (
    <span className="relative inline-flex shrink-0 align-[-2px]">
      <Icon
        className={className}
        strokeWidth={1.75}
        style={{ maskImage: CHIP_CUTOUT, WebkitMaskImage: CHIP_CUTOUT }}
      />
      <CiChip ci={ci} conflicts={conflicts} />
    </span>
  );
}

const CI_RANK: Record<LinkedPrCi, number> = { pass: 0, pending: 1, fail: 2 };

/** The worst CI among the open PRs, so a red check on any of them shows on the badge. */
export function worstLinkedPrCi(items: readonly LinkedWorkItem[]): LinkedPrCi | null {
  let worst: LinkedPrCi | null = null;
  for (const item of items) {
    if (item.kind !== "pr") continue;
    const state = peekLinkedPrState(item);
    if (state !== "open" && state !== "draft") continue;
    const ci = peekLinkedPrCi(item);
    if (ci && (!worst || CI_RANK[ci] > CI_RANK[worst])) worst = ci;
  }
  return worst;
}

function WatchLinkedPr({ item, cwd }: { item: LinkedWorkItem; cwd: string }) {
  useLinkedPrState(item, cwd);
  return null;
}

/** The sidebar badge's PR icon, tinted by the PR's state; `+n` counts the session's other PRs. */
export function LinkedPrBadgeContent({
  item,
  cwd,
  sessionId = "",
}: {
  item: LinkedWorkItem;
  cwd: string;
  sessionId?: string;
}) {
  const state = useLinkedPrState(item, cwd);
  const items = useSessionWorkItems(sessionId, item);
  const others = items.slice(1);
  const ci = useSyncExternalStore(subscribeLinkedPrStates, () =>
    worstLinkedPrCi(items),
  );
  const conflicts = useSyncExternalStore(subscribeLinkedPrStates, () =>
    items.some((pr) => pr.kind === "pr" && peekLinkedPrConflicts(pr)),
  );
  const title = prStateTitle(state, ci, conflicts);
  return (
    <span
      title={others.length ? `${title ?? ""}\n+${others.length} other ${others.length > 1 ? "PRs" : "PR"}`.trim() : title}
      className={`flex items-center gap-0.5 ${linkedPrStateTone(state)}`}
    >
      <LinkedPrStateIcon
        state={state}
        ci={ci}
        conflicts={conflicts}
        className="size-3"
      />
      {others.length ? (
        <span className="text-[10.5px] tabular-nums text-content/45">
          +{others.length}
        </span>
      ) : null}
      {others.map((other) => (
        <WatchLinkedPr key={other.url} item={other} cwd={cwd} />
      ))}
    </span>
  );
}
