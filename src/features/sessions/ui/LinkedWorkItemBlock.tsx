import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { CircleDot, ExternalLink } from "../../../shared/ui/icons";
import { githubAccounts } from "../../inbox/model/githubAccounts";
import {
  formatRelativeTime,
  githubWorkItem,
  githubWorkItemDetails,
  peekGithubWorkItem,
  peekGithubWorkItemDetails,
  type GithubWorkItem,
  type GithubWorkItemDetails,
} from "../../inbox/model/githubTasks";
import {
  LINKED_PR_ON_DEMAND_MS,
  LINKED_PR_REFRESH_MS,
  prStateOf,
  type LinkedPrState,
} from "../model/linkedPrState";
import type { LinkedWorkItem } from "../model/session";
import {
  LINKED_PR_STATE_TONE,
  LinkedPrCiPill,
  LinkedPrStateIcon,
  LinkedStatusPill,
  useLinkedPrCi,
  useLinkedPrState,
} from "./LinkedPrStateIcon";

const PR_STATE_LABEL: Record<LinkedPrState, string> = {
  open: "Open",
  draft: "Draft",
  merged: "Merged",
  closed: "Closed",
};

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

export function LinkedWorkItemBlock({
  item,
  cwd,
}: {
  item: LinkedWorkItem;
  cwd: string;
}) {
  const { workItem, details } = useLinkedWorkItemData(item, cwd);
  const ownLogins = useGithubLogins();
  const storedPrState = useLinkedPrState(item, cwd, LINKED_PR_ON_DEMAND_MS);
  const ci = useLinkedPrCi(item);
  const isPr = item.kind === "pr";
  const prState =
    storedPrState ?? (isPr && workItem ? prStateOf(workItem) : null);
  const state = isPr ? prPill(prState) : issuePill(workItem);
  const prActive = prState === "open" || prState === "draft";
  const review = prActive ? REVIEW[details?.reviewDecision ?? ""] : undefined;
  const author =
    details?.author && ownLogins && !ownLogins.has(details.author.toLowerCase())
      ? details.author
      : null;
  const updated = workItem?.updatedAt
    ? formatRelativeTime(workItem.updatedAt)
    : "";
  const byline = [author, updated].filter(Boolean).join(" · ");
  const labelCount = isPr ? 0 : (workItem?.labels.length ?? 0);

  return (
    <button
      type="button"
      aria-label={`Open ${item.repo} #${item.number} on GitHub`}
      onClick={(event) => {
        event.stopPropagation();
        void openUrl(item.url).catch(() => undefined);
      }}
      className="group mt-3 block w-full min-w-[276px] rounded-lg border border-stroke bg-content/[0.04] px-2.5 py-2 text-left transition-colors duration-100 ease-out hover:border-content/10 hover:bg-content/[0.07] active:scale-[0.99]"
    >
      <span className="flex items-center gap-1.5 text-[11px] text-content/55 [container-type:inline-size]">
        {isPr ? (
          <LinkedPrStateIcon
            state={prState}
            className={`size-3 shrink-0 ${prState ? LINKED_PR_STATE_TONE[prState] : "text-content/50"}`}
          />
        ) : (
          <CircleDot className={`size-3 shrink-0 ${state?.tone ?? "text-content/50"}`} />
        )}
        <span className="min-w-0 truncate">
          {item.repo} #{item.number}
        </span>
        <ExternalLink
          aria-hidden="true"
          className="ml-auto size-3 shrink-0 text-content/45 opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100"
        />
        {state ? (
          <span
            className={`shrink-0 rounded-full bg-content/[0.07] px-[7px] py-px text-[10px] font-medium ${state.tone}`}
          >
            {state.label}
          </span>
        ) : null}
      </span>
      {workItem ? (
        <span className="mt-1 line-clamp-2 text-[12px] font-medium leading-[1.4] text-content [container-type:inline-size]">
          {workItem.title}
        </span>
      ) : (
        <span className="mt-1.5 block h-3 w-4/5 rounded bg-content/10 motion-safe:animate-pulse" />
      )}
      {isPr && (ci || review) ? (
        <span className="mt-1.5 flex flex-nowrap items-center gap-1.5 whitespace-nowrap">
          {ci && prActive ? <LinkedPrCiPill ci={ci} /> : null}
          {review ? (
            <LinkedStatusPill label="Review" className={review.className}>
              {review.value}
            </LinkedStatusPill>
          ) : null}
        </span>
      ) : null}
      {labelCount > 0 || byline ? (
        <span className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5 text-[10.5px] text-content/45 [container-type:inline-size]">
          {!isPr ? <IssueLabels workItem={workItem} /> : null}
          {byline ? <span className="truncate">{byline}</span> : null}
        </span>
      ) : null}
    </button>
  );
}

function prPill(state: LinkedPrState | null) {
  return state
    ? { label: PR_STATE_LABEL[state], tone: LINKED_PR_STATE_TONE[state] }
    : null;
}

function issuePill(workItem: GithubWorkItem | null) {
  if (!workItem) return null;
  if (workItem.state.trim().toLowerCase() !== "closed") {
    return { label: "Open", tone: "text-emerald-400/90" };
  }
  return workItem.stateReason?.toLowerCase() === "not_planned"
    ? { label: "Closed", tone: "text-content/45" }
    : { label: "Closed", tone: "text-violet-400/90" };
}

function IssueLabels({ workItem }: { workItem: GithubWorkItem | null }) {
  const labels = workItem?.labels ?? [];
  return (
    <>
      {labels.slice(0, 2).map((label) => (
        <span
          key={label.name}
          className="inline-flex max-w-28 items-center gap-1 rounded-full border border-content/10 px-1.5 text-[10px] leading-4 text-content/75"
        >
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: labelColor(label.color) }}
          />
          <span className="truncate">{label.name}</span>
        </span>
      ))}
      {labels.length > 2 ? <span>+{labels.length - 2}</span> : null}
      {labels.length > 0 ? <span>·</span> : null}
    </>
  );
}

function labelColor(value: string): string {
  return /^[\da-f]{6}$/i.test(value.trim()) ? `#${value.trim()}` : "currentColor";
}

function useLinkedWorkItemData(item: LinkedWorkItem, cwd: string) {
  const { repo, kind, number } = item;
  const [workItem, setWorkItem] = useState<GithubWorkItem | null>(() =>
    peekGithubWorkItem(repo, kind, number),
  );
  const [details, setDetails] = useState<GithubWorkItemDetails | null>(() =>
    peekGithubWorkItemDetails(repo, kind, number),
  );

  useEffect(() => {
    setWorkItem(peekGithubWorkItem(repo, kind, number));
    setDetails(peekGithubWorkItemDetails(repo, kind, number));
    let cancelled = false;
    void githubWorkItem(cwd, repo, kind, number).then(
      (value) => !cancelled && setWorkItem(value),
      () => undefined,
    );
    // Reviews land while the PR is open: a cached decision is trusted for 3 minutes only.
    void githubWorkItemDetails(cwd, repo, kind, number, {
      maxAgeMs: LINKED_PR_REFRESH_MS,
    }).then(
      (value) => !cancelled && setDetails(value),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [cwd, repo, kind, number]);

  return { workItem, details };
}

let ownLogins: Promise<Set<string>> | null = null;

function useGithubLogins(): Set<string> | null {
  const [logins, setLogins] = useState<Set<string> | null>(null);
  useEffect(() => {
    ownLogins ??= githubAccounts().then(
      (accounts) => new Set(accounts.map((login) => login.toLowerCase())),
      () => new Set<string>(),
    );
    let cancelled = false;
    void ownLogins.then((value) => !cancelled && setLogins(value));
    return () => {
      cancelled = true;
    };
  }, []);
  return logins;
}
