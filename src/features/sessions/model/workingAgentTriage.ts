import type { LiveAgent } from "./liveAgents";
import { groupAgentsByProject, type WorkingAgentGroup } from "./workingAgentGroups";

export function triageAgents(agents: LiveAgent[]): {
  needsYou: LiveAgent[];
  running: WorkingAgentGroup[];
} {
  return {
    needsYou: agents.filter((agent) => agent.needsApproval || agent.done),
    running: groupAgentsByProject(
      agents.filter((agent) => !agent.needsApproval && !agent.done),
    ),
  };
}
