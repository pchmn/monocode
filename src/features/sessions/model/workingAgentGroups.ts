import { projectKey } from "../../../shared/lib/paths";
import type { LiveAgent } from "./liveAgents";

export type WorkingAgentGroup = { key: string; cwd: string; agents: LiveAgent[] };

// Groups follow their first agent, so the incoming priority (approval, live, done) is kept.
export function groupAgentsByProject(agents: LiveAgent[]): WorkingAgentGroup[] {
  const groups = new Map<string, WorkingAgentGroup>();
  for (const agent of agents) {
    const key = projectKey(agent.cwd);
    const group = groups.get(key);
    if (group) group.agents.push(agent);
    else groups.set(key, { key, cwd: agent.cwd, agents: [agent] });
  }
  return [...groups.values()];
}
