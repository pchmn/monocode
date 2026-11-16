import type { ReactNode } from "react";
import { projectKey, projectName } from "../../../shared/lib/paths";
import { Check, CircleAlert } from "../../../shared/ui/icons";
import {
  resolveTabGroupColor,
  resolveTabGroupLabel,
  resolveTabGroupMascot,
} from "../../workspace/model/tabGroups";
import { ProjectMascot } from "../../projects/ui/ProjectMascot";
import { useSessionBackgroundTasks } from "../model/backgroundTasks";
import { formatLiveElapsed, type LiveAgent } from "../model/liveAgents";
import { triageAgents } from "../model/workingAgentTriage";
import { BackgroundDot, backgroundActivity } from "./BackgroundTasks";
import { HarnessIcon } from "./HarnessIcon";
import { TerminalSpinner } from "./TerminalSpinner";

type Appearance = {
  groupLabels: Record<string, string>;
  groupColors: Record<string, number>;
  groupCustomColors: Record<string, string>;
  groupMascots: Record<string, string>;
};

type RowProps = Appearance & {
  agent: LiveAgent;
  now: number;
  selected: boolean;
  onSelect?: (sessionId: string) => void;
};

export function WorkingAgentTriage({
  agents,
  now,
  activeSessionId,
  onSelect,
  ...appearance
}: Appearance & {
  agents: LiveAgent[];
  now: number;
  activeSessionId?: string;
  onSelect?: (sessionId: string) => void;
}) {
  const { needsYou, running } = triageAgents(agents);
  const split = needsYou.length > 0 && running.length > 0;
  const rows = (list: LiveAgent[], gap: string) =>
    list.length > 0 ? (
      <div className={`flex shrink-0 flex-col ${gap}`}>
        {list.map((agent) => (
          <AgentRow
            key={agent.id}
            agent={agent}
            now={now}
            selected={agent.id === activeSessionId}
            onSelect={onSelect}
            {...appearance}
          />
        ))}
      </div>
    ) : null;

  return (
    <>
      {split ? <SectionLabel>Needs you</SectionLabel> : null}
      {/* Tinted approval cards would merge at 1px. */}
      {rows(needsYou, "gap-1")}
      {split ? <SectionLabel>Running</SectionLabel> : null}
      {rows(running.flatMap((group) => group.agents), "gap-px")}
    </>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 px-2 pb-0.5 pt-1.5 text-[11px] text-content/40">
      {children}
    </span>
  );
}

function useRow({ agent, now, groupLabels, groupColors, groupCustomColors, groupMascots }: RowProps) {
  const seed = projectName(agent.cwd);
  const key = projectKey(agent.cwd);
  const backgroundTasks = useSessionBackgroundTasks(agent.id);
  const resting = !agent.needsApproval && !agent.done && backgroundTasks.length > 0;
  const activity = resting ? backgroundActivity(backgroundTasks) : agent.activity;
  const elapsed = agent.done
    ? agent.durationMs != null
      ? formatLiveElapsed(0, agent.durationMs)
      : ""
    : agent.startedAt != null
      ? formatLiveElapsed(agent.startedAt, now)
      : "";
  const project = resolveTabGroupLabel(key, groupLabels, seed);
  const details = [agent.title, project, activity, elapsed].filter(Boolean);
  return {
    seed,
    project,
    color: resolveTabGroupColor(key, groupColors, groupCustomColors, seed),
    mascot: resolveTabGroupMascot(key, groupMascots),
    resting,
    activity,
    elapsed,
    title: details.join("\n"),
    label: details.join(", "),
  };
}

function statusTone(agent: LiveAgent): string {
  if (agent.needsApproval) return "text-amber-400";
  if (agent.done) return "text-emerald-400";
  return "text-content/50";
}

function StatusGlyph({ agent, resting }: { agent: LiveAgent; resting: boolean }) {
  if (agent.needsApproval) return <CircleAlert className="size-3 shrink-0" strokeWidth={1.75} />;
  if (agent.done) return <Check className="size-3 shrink-0" strokeWidth={2.25} />;
  if (resting)
    return (
      <span className="grid size-3 shrink-0 place-items-center">
        <BackgroundDot />
      </span>
    );
  return (
    <TerminalSpinner className="inline-block w-3 shrink-0 select-none text-center text-[11px] leading-none" />
  );
}

// The state glyph leads every row, so Needs you and Running share one shape.
function AgentRow(props: RowProps) {
  const { agent, selected, onSelect } = props;
  const row = useRow(props);
  const live = !agent.needsApproval && !agent.done;
  const idle = agent.needsApproval ? "bg-amber-400/8 hover:bg-amber-400/12" : "hover:bg-content/8";
  return (
    <button
      type="button"
      title={row.title}
      aria-label={row.label}
      aria-current={selected ? "true" : undefined}
      data-live-agent-card={agent.id}
      onClick={() => onSelect?.(agent.id)}
      className={`${selected ? "bg-selection" : idle} grid w-full min-w-0 shrink-0 grid-cols-[12px_minmax(0,1fr)] gap-x-2 gap-y-0.5 rounded-md px-2 py-1.5 text-left`}
    >
      <span className={`flex h-[18px] items-center ${statusTone(agent)}`}>
        <StatusGlyph agent={agent} resting={row.resting} />
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <span className={`min-w-0 flex-1 truncate text-[13px] leading-snug ${live ? "" : "font-semibold"}`}>
          {agent.title}
        </span>
        {row.elapsed ? (
          <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-content/40">
            {row.elapsed}
          </span>
        ) : null}
      </span>
      <span className="col-start-2 flex min-w-0 items-center gap-1.5 text-[11px] leading-tight text-content/45">
        <ProjectMascot project={row.seed} color={row.color} name={row.mascot} className="size-2 shrink-0" />
        <span className="shrink-0 text-content/60">{row.project}</span>
        {row.activity ? (
          <>
            <span aria-hidden className="text-content/25">·</span>
            <span className={`min-w-0 flex-1 truncate ${agent.needsApproval ? "text-amber-400/90" : ""}`}>
              {row.activity}
            </span>
          </>
        ) : (
          <span className="flex-1" />
        )}
        <HarnessIcon harness={agent.harness} className="size-3 shrink-0 opacity-45" />
      </span>
    </button>
  );
}
