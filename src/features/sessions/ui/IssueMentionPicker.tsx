import { useEffect, useRef } from "react";
import {
  CircleDot,
  GitPullRequest,
  GitPullRequestDraft,
} from "../../../shared/ui/icons";
import { useLockOverscroll } from "../../../shared/hooks/useLockOverscroll";
import { MatchText } from "../../../shared/ui/MatchText";
import type { RankedIssue } from "../model/issueMentions";

type Props = {
  items: RankedIssue[];
  query: string;
  active: number;
  loading: boolean;
  error: string | null;
  onActive: (index: number) => void;
  onPick: (item: RankedIssue) => void;
};

function kindIcon(item: RankedIssue) {
  if (item.kind === "issue") return { Icon: CircleDot, tone: "text-emerald-400/90" };
  if (item.draft) return { Icon: GitPullRequestDraft, tone: "text-content/50" };
  return { Icon: GitPullRequest, tone: "text-emerald-400/90" };
}

export function IssueMentionPicker({
  items,
  query,
  active,
  loading,
  error,
  onActive,
  onPick,
}: Props) {
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

  const empty = loading
    ? "Loading issues and pull requests…"
    : error
      ? error
      : query.trim()
        ? "No matching open issues or pull requests"
        : "No open issues or pull requests";

  return (
    <div
      data-mention-picker
      className="overflow-hidden rounded-lg border border-content/10 bg-content/5 backdrop-blur-xl"
    >
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
            const { Icon, tone } = kindIcon(item);
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
