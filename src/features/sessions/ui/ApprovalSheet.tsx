import { useEffect, useId, useRef, useState } from "react";
import type { ApprovalDecision } from "../../../integrations/harness";
import { shouldHandleListNavigation } from "../../workspace/model/tabKeys";
import { approvalSheetKeyAction } from "../model/approvalSheetKeys";
import type { Block } from "../model/session";
import { needsApproval, toolCallLabel } from "../model/transcriptActivity";

const OPTIONS: { label: string; decision: ApprovalDecision }[] = [
  { label: "Allow", decision: "allow" },
  { label: "Deny", decision: "deny" },
];

type Props = {
  blocks: Block[];
  cwd?: string;
  onApproval: (requestId: number, decision: ApprovalDecision) => void;
};

export function ApprovalSheet({ blocks, cwd, onApproval }: Props) {
  const pending = blocks.filter(needsApproval);
  const current = pending[0];
  const requestId = current?.approval?.requestId;
  const [selected, setSelected] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const optionId = useId();
  const live = useRef({ selected, onApproval });
  live.current = { selected, onApproval };

  useEffect(() => setSelected(0), [requestId]);

  useEffect(() => {
    if (requestId === undefined) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const root = rootRef.current;
      const target = e.target instanceof Element ? e.target : null;
      if (
        !root ||
        !target ||
        e.defaultPrevented ||
        e.isComposing ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.shiftKey
      )
        return;
      const inSheet = root.contains(target);
      // Scoped to this pane's dock so split panes don't answer each other.
      const inDockComposer =
        !!root.closest("[data-session-composer]")?.contains(target) &&
        shouldHandleListNavigation({
          blockedTarget: target.matches("input, textarea, select"),
          emptyComposerTarget: target.matches(
            'textarea[data-composer-empty="true"]',
          ),
          surfaceOpen: false,
        });
      if (!inSheet && !inDockComposer) return;
      const action = approvalSheetKeyAction(
        e.key,
        live.current.selected,
        OPTIONS.length,
      );
      if (!action) return;
      e.preventDefault();
      if (action.type === "move") {
        setSelected(action.index);
        return;
      }
      const decision = OPTIONS[action.index]?.decision;
      if (decision) live.current.onApproval(requestId, decision);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [requestId]);

  if (!current || requestId === undefined) return null;
  const label = toolCallLabel(current, cwd);

  return (
    <div
      ref={rootRef}
      className="mb-2 rounded-xl border border-dashed border-content/20 bg-content/5 px-3 py-2"
    >
      <div className="mb-1.5 flex items-center gap-2 text-[12px]">
        <span className="shrink-0 text-amber-400">Approval needed</span>
        {pending.length > 1 ? (
          <span className="shrink-0 text-content/40">1/{pending.length}</span>
        ) : null}
        <span
          className="min-w-0 flex-1 truncate font-mono text-content/70"
          title={label}
        >
          {label}
        </span>
      </div>
      <div
        role="listbox"
        tabIndex={-1}
        aria-label={`Approval options for ${label}`}
        aria-activedescendant={`${optionId}-${selected}`}
        className="flex flex-col outline-none"
      >
        {OPTIONS.map((option, index) => (
          <button
            key={option.decision}
            id={`${optionId}-${index}`}
            type="button"
            role="option"
            aria-selected={index === selected}
            tabIndex={-1}
            onMouseEnter={() => setSelected(index)}
            onClick={() => onApproval(requestId, option.decision)}
            className={`rounded-md px-2 py-1 text-left text-[12px] ${index === selected ? "bg-content/10 text-content" : "text-content/60"}`}
          >
            <span className="mr-2 text-content/40">{index + 1}.</span>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
