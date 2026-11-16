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
  const rowProps = (agent: LiveAgent) => ({
    agent,
    now,
    selected: agent.id === activeSessionId,
    onSelect,
    ...appearance,
  });

  return (
    <>
      {split ? <SectionLabel>Needs you</SectionLabel> : null}
      {needsYou.map((agent) => (
        <AttentionCard key={agent.id} {...rowProps(agent)} />
      ))}
      {split ? <SectionLabel>Running</SectionLabel> : null}
      {running.map((group) => {
        const seed = projectName(group.cwd);
        const color = resolveTabGroupColor(
          group.key,
          appearance.groupColors,
          appearance.groupCustomColors,
          seed,
        );
        return (
          <div
            key={group.key}
            data-working-group={group.key}
            title={resolveTabGroupLabel(group.key, appearance.groupLabels, seed)}
            className="flex min-w-0 shrink-0"
          >
            <div className="flex w-6 shrink-0 flex-col items-center pt-[10px]">
              <ProjectMascot
                project={seed}
                color={color}
                name={resolveTabGroupMascot(group.key, appearance.groupMascots)}
                className="size-2 shrink-0"
                active
              />
              {group.agents.length > 1 ? (
                <span
                  aria-hidden
                  className="mt-1 w-px flex-1 rounded-full"
                  style={{ background: `color-mix(in srgb, ${color} 40%, transparent)` }}
                />
              ) : null}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-px">
              {group.agents.map((agent) => (
                <RunningLine key={agent.id} {...rowProps(agent)} />
              ))}
            </div>
          </div>
        );
      })}
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
    color: resolveTabGroupColor(key, groupColors, groupCustomColors, seed),
    mascot: resolveTabGroupMascot(key, groupMascots),
    resting,
    activity,
    elapsed,
    title: details.join("\n"),
    label: details.join(", "),
  };
}

function rowClass(selected: boolean, extra: string, idle = "hover:bg-content/8"): string {
  return `${selected ? "bg-selection" : idle} ${extra}`;
}

function AttentionCard(props: RowProps) {
  const { agent, selected, onSelect } = props;
  const row = useRow(props);
  return (
    <button
      type="button"
      title={row.title}
      aria-label={row.label}
      aria-current={selected ? "true" : undefined}
      data-live-agent-card={agent.id}
      onClick={() => onSelect?.(agent.id)}
      className={rowClass(
        selected,
        "flex w-full min-w-0 shrink-0 flex-col gap-0.5 rounded-md px-2 py-1.5 text-left",
        agent.needsApproval ? "bg-amber-400/8 hover:bg-amber-400/12" : undefined,
      )}
    >
      <span className="flex w-full min-w-0 items-center gap-2">
        <ProjectMascot project={row.seed} color={row.color} name={row.mascot} className="size-2 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-snug">
          {agent.title}
        </span>
        {row.elapsed ? (
          <span className="shrink-0 text-[11px] tabular-nums text-content/40">{row.elapsed}</span>
        ) : null}
      </span>
      <span
        className={`flex w-full min-w-0 items-center gap-1.5 pl-4 text-[11px] leading-tight ${
          agent.needsApproval ? "text-amber-400" : "text-emerald-400"
        }`}
      >
        {agent.needsApproval ? (
          <CircleAlert className="size-3 shrink-0" strokeWidth={1.75} />
        ) : (
          <Check className="size-3 shrink-0" strokeWidth={2.25} />
        )}
        <span className="min-w-0 truncate">{row.activity}</span>
      </span>
    </button>
  );
}

// Running agents need nothing from the user: one line each, the activity lives in the tooltip.
function RunningLine(props: RowProps) {
  const { agent, selected, onSelect } = props;
  const row = useRow(props);
  return (
    <button
      type="button"
      title={row.title}
      aria-label={row.label}
      aria-current={selected ? "true" : undefined}
      data-live-agent-card={agent.id}
      onClick={() => onSelect?.(agent.id)}
      className={rowClass(
        selected,
        "flex h-7 w-full min-w-0 shrink-0 items-center gap-2 rounded-md px-2 text-left",
      )}
    >
      {row.resting ? (
        <span className="grid w-3 shrink-0 place-items-center">
          <BackgroundDot />
        </span>
      ) : (
        <TerminalSpinner className="inline-block w-3 shrink-0 select-none text-center text-[11px] leading-none text-content/50" />
      )}
      <span className="min-w-0 flex-1 truncate text-[13px] leading-snug">{agent.title}</span>
      {row.elapsed ? (
        <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-content/40">
          {row.elapsed}
        </span>
      ) : null}
      <HarnessIcon harness={agent.harness} className="size-3 shrink-0 opacity-45" />
    </button>
  );
}
