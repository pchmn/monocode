import { useEffect, useRef } from "react";
import {
  CheckCircle,
  CircleDot,
  CircleX,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
} from "../../../shared/ui/icons";
import { useLockOverscroll } from "../../../shared/hooks/useLockOverscroll";
import { MatchText } from "../../../shared/ui/MatchText";
import type { IssueScope, RankedIssue } from "../model/issueMentions";
import type { useIssueMentions } from "../hooks/useIssueMentions";

type Props = {
  mentions: ReturnType<typeof useIssueMentions>;
};

const SCOPES: { value: IssueScope; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "all", label: "All" },
];

function statusIcon(item: RankedIssue) {
  const pr = item.kind === "pr";
  if (item.state === "merged") return { Icon: GitMerge, tone: "text-violet-400/90" };
  if (item.state === "closed") {
    if (!pr && item.stateReason === "completed") {
      return { Icon: CheckCircle, tone: "text-violet-400/90" };
    }
    return { Icon: pr ? GitPullRequestClosed : CircleX, tone: "text-rose-400/90" };
  }
  if (pr && item.draft) return { Icon: GitPullRequestDraft, tone: "text-content/50" };
  return { Icon: pr ? GitPullRequest : CircleDot, tone: "text-emerald-400/90" };
}

export function IssueMentionPicker({ mentions }: Props) {
  const {
    items,
    query,
    active,
    loading,
    searching,
    error,
    scope,
    setScope,
    setActive: onActive,
    pick: onPick,
  } = mentions;
  const lockOverscroll = useLockOverscroll<HTMLDivElement>();
  const activeRef = useRef<HTMLButtonElement>(null);
  // Rows scrolled under a still pointer must not steal the keyboard selection.
  const pointerMoved = useRef(false);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  useEffect(() => {
    pointerMoved.current = false;
  }, [items]);

  const which = scope === "open" ? "open issues or pull requests" : "issues or pull requests";
  const empty = loading
    ? "Loading issues and pull requests…"
    : error
      ? error
      : searching
        ? "Searching GitHub…"
        : query.trim()
          ? `No matching ${which}`
          : `No ${which}`;

  return (
    <div
      data-mention-picker
      className="overflow-hidden rounded-lg border border-content/10 bg-content/5 backdrop-blur-xl"
    >
      <div className="flex items-center gap-1 border-b border-content/10 px-2 py-1">
        {SCOPES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={scope === value}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setScope(value)}
            className={`rounded px-1.5 py-0.5 text-[11px] ${
              scope === value
                ? "bg-content/10 text-content"
                : "text-content/50 hover:text-content"
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-content/40">
          {searching && items.length > 0 ? "Searching GitHub…" : "⌥A toggles"}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="px-3 py-2.5 text-[12px] text-content/50">{empty}</p>
      ) : (
        <div
          ref={lockOverscroll}
          role="listbox"
          aria-label="Issues and pull requests"
          onMouseMove={() => {
            pointerMoved.current = true;
          }}
          className="max-h-[min(240px,40vh)] overflow-y-auto overscroll-none px-1 py-1"
        >
          {items.map((item, index) => {
            const highlighted = index === active;
            const { Icon, tone } = statusIcon(item);
            return (
              <button
                key={`${item.kind}:${item.number}`}
                ref={highlighted ? activeRef : undefined}
                type="button"
                role="option"
                aria-selected={highlighted}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => {
                  if (pointerMoved.current) onActive(index);
                }}
                onClick={() => onPick(item)}
                className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] leading-none ${
                  highlighted ? "bg-selection text-content" : "text-content"
                }`}
              >
                <Icon className={`size-3.5 shrink-0 ${tone}`} strokeWidth={1.75} />
                <span className="shrink-0 font-mono text-[11px] text-content/50">
                  #{item.number}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate ${
                    highlighted ? "text-mention" : ""
                  }`}
                >
                  <MatchText
                    text={item.title}
                    positions={item.positions}
                    active={Boolean(query.trim())}
                  />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
