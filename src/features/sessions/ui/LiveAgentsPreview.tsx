import { useEffect, useState } from "react";
import type { LiveAgent } from "../model/liveAgents";
import {
  loadTabGroupColors,
  loadTabGroupCustomColors,
  loadTabGroupLabels,
  loadTabGroupMascots,
} from "../../workspace/model/tabGroups";
import { useWorkingPanelCollapsed } from "../model/workingPanelCollapsed";
import { WorkingPanelHeader } from "./WorkingPanelHeader";
import { WorkingAgentList } from "./WorkingAgentList";
import { WorkingAgentTriage } from "./WorkingAgentTriage";

type Props = {
  agents: LiveAgent[];
  activeSessionId?: string;
  onSelect?: (sessionId: string) => void;
  bottomSpacing?: boolean;
  groupLabels?: Record<string, string>;
  groupColors?: Record<string, number>;
  groupCustomColors?: Record<string, string>;
  groupMascots?: Record<string, string>;
};

export function LiveAgentsPreview({
  agents,
  activeSessionId,
  onSelect,
  bottomSpacing = false,
  groupLabels: groupLabelsProp,
  groupColors: groupColorsProp,
  groupCustomColors: groupCustomColorsProp,
  groupMascots: groupMascotsProp,
}: Props) {
  const [loadedGroupLabels] = useState(loadTabGroupLabels);
  const [loadedGroupColors] = useState(loadTabGroupColors);
  const [loadedGroupCustomColors] = useState(loadTabGroupCustomColors);
  const [loadedGroupMascots] = useState(loadTabGroupMascots);
  const groupLabels = groupLabelsProp ?? loadedGroupLabels;
  const groupColors = groupColorsProp ?? loadedGroupColors;
  const groupCustomColors = groupCustomColorsProp ?? loadedGroupCustomColors;
  const groupMascots = groupMascotsProp ?? loadedGroupMascots;
  const [collapsed, toggleCollapsed] = useWorkingPanelCollapsed();
  const [now, setNow] = useState(() => Date.now());
  // The active session's own progress is already on screen.
  const shown = agents.some((agent) => agent.id !== activeSessionId);
  const ticking =
    shown &&
    agents.some((agent) => !agent.done && agent.startedAt != null);

  useEffect(() => {
    if (!ticking) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [ticking]);

  if (!shown) return null;

  return (
    <section
      aria-label="Working agents"
      className={`flex min-h-0 flex-col px-2 ${bottomSpacing ? "pb-2" : ""}`}
      data-live-agents-preview="full"
    >
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {agents.length} working agents
      </span>
      <div className="flex min-h-0 flex-col overflow-hidden rounded-lg bg-content/5">
        <WorkingPanelHeader
          collapsed={collapsed}
          count={agents.length}
          needsApproval={agents.some((agent) => agent.needsApproval)}
          onToggle={toggleCollapsed}
        />
        {collapsed ? null : (
        <WorkingAgentList count={agents.length}>
          <WorkingAgentTriage
            agents={agents}
            now={now}
            activeSessionId={activeSessionId}
            onSelect={onSelect}
            {...{ groupLabels, groupColors, groupCustomColors, groupMascots }}
          />
        </WorkingAgentList>
        )}
      </div>
    </section>
  );
}
