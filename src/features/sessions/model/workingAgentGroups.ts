import { useState } from "react";
import { projectKey } from "../../../shared/lib/paths";
import type { LiveAgent } from "./liveAgents";

const COLLAPSED_KEY = "monocode.workingCollapsedProjects";

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

function readCollapsed(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((k) => typeof k === "string") : []);
  } catch {
    return new Set();
  }
}

export function useCollapsedProjects(): [ReadonlySet<string>, (key: string) => void] {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = (key: string) => {
    const next = new Set(collapsed);
    if (!next.delete(key)) next.add(key);
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
    } catch {
      // private mode / quota
    }
    setCollapsed(next);
  };
  return [collapsed, toggle];
}
