import { Fragment, type ReactNode } from "react";
import { projectName } from "../../../shared/lib/paths";
import { ChevronDown } from "../../../shared/ui/icons";
import {
  resolveTabGroupColor,
  resolveTabGroupLabel,
  resolveTabGroupMascot,
} from "../../workspace/model/tabGroups";
import { ProjectMascot } from "../../projects/ui/ProjectMascot";
import type { LiveAgent } from "../model/liveAgents";
import {
  groupAgentsByProject,
  useCollapsedProjects,
  type WorkingAgentGroup,
} from "../model/workingAgentGroups";

type Appearance = {
  groupLabels: Record<string, string>;
  groupColors: Record<string, number>;
  groupCustomColors: Record<string, string>;
  groupMascots: Record<string, string>;
};

export function WorkingAgentGroups({
  agents,
  renderCard,
  ...appearance
}: Appearance & {
  agents: LiveAgent[];
  renderCard: (agent: LiveAgent, inGroup: boolean) => ReactNode;
}) {
  const [collapsed, toggle] = useCollapsedProjects();
  const groups = groupAgentsByProject(agents);
  if (groups.length < 2) return <>{agents.map((agent) => renderCard(agent, false))}</>;

  return (
    <>
      {groups.map((group) => {
        const folded = collapsed.has(group.key);
        return (
          <Fragment key={group.key}>
            <GroupHeader
              group={group}
              folded={folded}
              onToggle={() => toggle(group.key)}
              {...appearance}
            />
            {folded ? null : group.agents.map((agent) => renderCard(agent, true))}
          </Fragment>
        );
      })}
    </>
  );
}

function GroupHeader({
  group,
  folded,
  onToggle,
  groupLabels,
  groupColors,
  groupCustomColors,
  groupMascots,
}: Appearance & {
  group: WorkingAgentGroup;
  folded: boolean;
  onToggle: () => void;
}) {
  const seed = projectName(group.cwd);
  const label = resolveTabGroupLabel(group.key, groupLabels, seed);
  return (
    <button
      type="button"
      aria-expanded={!folded}
      data-working-group={group.key}
      onClick={onToggle}
      className="flex w-full min-w-0 items-center gap-1.5 rounded-md px-2 pb-0.5 pt-1.5 text-left text-[11px] text-content/50 hover:text-content/80"
    >
      <ProjectMascot
        project={seed}
        color={resolveTabGroupColor(group.key, groupColors, groupCustomColors, seed)}
        name={resolveTabGroupMascot(group.key, groupMascots)}
        className="size-2 shrink-0"
      />
      <span className="min-w-0 truncate font-medium">{label}</span>
      <ChevronDown
        className={`size-3 shrink-0 text-content/40 transition-transform motion-reduce:transition-none ${
          folded ? "-rotate-90" : ""
        }`}
        strokeWidth={2}
      />
      <span className="ml-auto flex shrink-0 items-center gap-1.5 tabular-nums text-content/40">
        {folded && group.agents.some((agent) => agent.needsApproval) ? (
          <span aria-label="Needs approval" className="size-1.5 rounded-full bg-amber-400" />
        ) : null}
        {group.agents.length}
      </span>
    </button>
  );
}
