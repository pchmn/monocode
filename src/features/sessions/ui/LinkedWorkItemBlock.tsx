import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import {
  CheckCircle,
  CircleDot,
  CircleSlash,
  ExternalLink,
} from "../../../shared/ui/icons";
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
} from "../model/linkedPrState";
import type { LinkedWorkItem } from "../model/session";
import {
  LINKED_PR_STATE_TONE,
  LinkedPrStateIcon,
  prStateTitle,
  useLinkedPrCi,
  useLinkedPrState,
} from "./LinkedPrStateIcon";
import { LinkedPrStatusPills } from "./LinkedPrStatusPills";

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
  const issue = isPr ? null : issueState(workItem);
  const stateLabel = isPr ? prStateTitle(prState, null) : issue?.label;
  const prActive = prState === "open" || prState === "draft";
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
      aria-label={`Open ${item.repo} #${item.number} on GitHub${stateLabel ? ` (${stateLabel})` : ""}`}
      onClick={(event) => {
        event.stopPropagation();
        void openUrl(item.url).catch(() => undefined);
      }}
      className="group mt-3 block w-full min-w-[276px] cursor-pointer rounded-lg border border-stroke bg-content/[0.04] px-2.5 py-2 text-left transition-colors duration-100 ease-out hover:border-content/10 hover:bg-content/[0.07] active:scale-[0.99]"
    >
      <span className="flex items-center gap-1.5 text-[11px] text-content/55 [container-type:inline-size]">
        <span title={stateLabel} className="flex shrink-0">
          {isPr ? (
            <LinkedPrStateIcon
              state={prState}
              className={`size-3 shrink-0 ${prState ? LINKED_PR_STATE_TONE[prState] : "text-content/50"}`}
            />
          ) : (
            <IssueStateIcon state={issue} />
          )}
        </span>
        <span className="min-w-0 truncate">{item.repo}</span>
        <ExternalLink
          aria-hidden="true"
          className="ml-auto size-3 shrink-0 text-content/45 opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100"
        />
        <span className="shrink-0 tabular-nums text-content/75">
          #{item.number}
        </span>
      </span>
      {workItem ? (
        <span className="mt-1 line-clamp-2 text-[12px] font-medium leading-[1.4] text-content [container-type:inline-size]">
          {workItem.title}
        </span>
      ) : (
        <span className="mt-1.5 block h-3 w-4/5 rounded bg-content/10 motion-safe:animate-pulse" />
      )}
      {isPr ? (
        <LinkedPrStatusPills
          ci={ci}
          active={prActive}
          reviewDecision={details?.reviewDecision}
          className="mt-1.5"
        />
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

const ISSUE_STATE = {
  open: { label: "Open", tone: "text-emerald-400/90", Icon: CircleDot },
  completed: { label: "Closed", tone: "text-violet-400/90", Icon: CheckCircle },
  not_planned: {
    label: "Closed as not planned",
    tone: "text-content/45",
    Icon: CircleSlash,
  },
};

function issueState(workItem: GithubWorkItem | null) {
  if (!workItem) return null;
  if (workItem.state.trim().toLowerCase() !== "closed") return ISSUE_STATE.open;
  return workItem.stateReason?.toLowerCase() === "not_planned"
    ? ISSUE_STATE.not_planned
    : ISSUE_STATE.completed;
}

function IssueStateIcon({
  state,
}: {
  state: (typeof ISSUE_STATE)[keyof typeof ISSUE_STATE] | null;
}) {
  const Icon = state?.Icon ?? CircleDot;
  return (
    <Icon className={`size-3 shrink-0 ${state?.tone ?? "text-content/50"}`} />
  );
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
