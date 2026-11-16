import { useEffect, useSyncExternalStore, type CSSProperties } from "react";
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
  fail: "M2.3 2.3 7.7 7.7M7.7 2.3 2.3 7.7",
} as const;
type Cutout = Pick<
  CSSProperties,
  | "maskImage"
  | "maskComposite"
  | "maskSize"
  | "WebkitMaskImage"
  | "WebkitMaskComposite"
  | "WebkitMaskSize"
>;

const DOT_CUTOUT =
  "radial-gradient(circle at calc(100% - 1.5px) calc(100% - 1.5px), transparent 3.6px, #000 4.1px)";

// Cut out under the badge so the pulse never shows the icon; glyph coordinates assume a 12px icon.
function cutoutStyle(ci: LinkedPrCi): Cutout {
  if (ci === "pending") return { maskImage: DOT_CUTOUT, WebkitMaskImage: DOT_CUTOUT };
  const glyph = `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'><path d='${CI_GLYPH[ci]}' transform='translate(7 7) scale(.7)' fill='none' stroke='black' stroke-width='4.6' stroke-linecap='round' stroke-linejoin='round'/></svg>`,
  )}")`;
  const layers = `${glyph}, linear-gradient(#000, #000)`;
  return {
    maskImage: layers,
    WebkitMaskImage: layers,
    maskComposite: "exclude",
    WebkitMaskComposite: "xor",
    maskSize: "100% 100%",
    WebkitMaskSize: "100% 100%",
  };
}

function CiBadge({ ci }: { ci: LinkedPrCi }) {
  const box = "absolute -bottom-0.5 -right-0.5 size-[7px]";
  if (ci === "pending")
    return (
      <span className={`${box} grid place-items-center`}>
        <span className="size-[6px] animate-pulse rounded-full bg-amber-400" />
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
      <path d={CI_GLYPH[ci]} />
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
        style={cutoutStyle(ci)}
      />
      <CiBadge ci={ci} />
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
