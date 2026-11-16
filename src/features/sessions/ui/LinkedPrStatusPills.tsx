import { LINKED_PR_ON_DEMAND_MS, type LinkedPrCi } from "../model/linkedPrState";
import type { LinkedWorkItem } from "../model/session";
import {
  LinkedPrCiPill,
  LinkedStatusPill,
  useLinkedPrCi,
  useLinkedPrState,
} from "./LinkedPrStateIcon";

const REVIEW: Record<string, { value: string; className: string }> = {
  APPROVED: {
    value: "approved",
    className: "bg-emerald-400/15 text-emerald-400/90",
  },
  CHANGES_REQUESTED: {
    value: "changes requested",
    className: "bg-orange-400/15 text-orange-400/95",
  },
  REVIEW_REQUIRED: {
    value: "awaiting",
    className: "bg-content/[0.06] text-content/55",
  },
};

/** CI and review pills of an open or draft PR; nothing once it is merged or closed. */
export function LinkedPrStatusPills({
  ci,
  active,
  reviewDecision,
  className = "",
}: {
  ci: LinkedPrCi | null;
  active: boolean;
  reviewDecision?: string;
  className?: string;
}) {
  const review = active ? REVIEW[reviewDecision ?? ""] : undefined;
  if (!(ci && active) && !review) return null;
  return (
    <span
      className={`flex flex-nowrap items-center gap-1.5 whitespace-nowrap ${className}`}
    >
      {ci && active ? <LinkedPrCiPill ci={ci} /> : null}
      {review ? (
        <LinkedStatusPill label="Review" className={review.className}>
          {review.value}
        </LinkedStatusPill>
      ) : null}
    </span>
  );
}

/** For a PR met outside the session's link (a chip in the transcript): fetches its state and CI. */
export function GithubPrStatusPills({
  repo,
  number,
  cwd,
  reviewDecision,
  className,
}: {
  repo: string;
  number: number;
  cwd?: string;
  reviewDecision?: string;
  className?: string;
}) {
  const item: LinkedWorkItem = {
    kind: "pr",
    repo,
    number,
    url: `https://github.com/${repo}/pull/${number}`,
  };
  const state = useLinkedPrState(item, cwd || ".", LINKED_PR_ON_DEMAND_MS);
  const ci = useLinkedPrCi(item);
  return (
    <LinkedPrStatusPills
      ci={ci}
      active={state === "open" || state === "draft"}
      reviewDecision={reviewDecision}
      className={className}
    />
  );
}
