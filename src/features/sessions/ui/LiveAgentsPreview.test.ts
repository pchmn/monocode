// @vitest-environment happy-dom
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveAgent } from "../model/liveAgents";
import { usePublishBackgroundTasks } from "../model/backgroundTasks";
import type { Session } from "../model/session";
import { LiveAgentsPreview } from "./LiveAgentsPreview";

let container: HTMLDivElement;
let root: Root;

function agent(
  id: string,
  cwd: string,
  patch: Partial<LiveAgent> = {},
): LiveAgent {
  return {
    id,
    cwd,
    title: `Agent ${id}`,
    harness: "codex",
    activity: "Working",
    startedAt: 1_000,
    needsApproval: false,
    done: false,
    ...patch,
  };
}

function render(
  props: ComponentProps<typeof LiveAgentsPreview>,
  sessions: Session[] = [],
) {
  function Harness() {
    usePublishBackgroundTasks(sessions);
    return createElement(LiveAgentsPreview, props);
  }
  act(() => root.render(createElement(Harness)));
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const stored = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
    clear: () => stored.clear(),
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("LiveAgentsPreview", () => {
  it("lists agents that need the user first, then running agents by project", () => {
    render({
      agents: [
        agent("b-1", "/repo/b", { needsApproval: true }),
        agent("a-1", "/repo/a"),
        agent("b-2", "/repo/b"),
        agent("a-2", "/repo/a"),
        agent("c-1", "/repo/c", { done: true, activity: "Done" }),
      ],
      groupLabels: { "/repo/a": "Alpha", "/repo/b": "Beta" },
      groupColors: {},
      groupCustomColors: {},
      groupMascots: {},
    });

    expect(container.textContent).toContain("Needs you");
    expect(container.textContent).toContain("Running");
    const cards = Array.from(
      container.querySelectorAll<HTMLElement>("[data-live-agent-card]"),
    );
    expect(cards.map((card) => card.dataset.liveAgentCard)).toEqual([
      "b-1",
      "c-1",
      "a-1",
      "a-2",
      "b-2",
    ]);
    const groups = Array.from(
      container.querySelectorAll<HTMLElement>("[data-working-group]"),
    );
    expect(groups.map((group) => group.title)).toEqual(["Alpha", "Beta"]);
    expect(groups[0].querySelector(".mascot-active")).not.toBeNull();
    expect(cards[2].getAttribute("aria-label")).toContain("Alpha");
  });

  it("drops the section labels when every agent is running", () => {
    render({ agents: [agent("a-1", "/repo/a"), agent("a-2", "/repo/a")] });

    expect(container.textContent).not.toContain("Needs you");
    expect(container.textContent).not.toContain("Running");
    expect(container.querySelectorAll("[data-live-agent-card]")).toHaveLength(2);
  });

  it("shows only when an agent runs outside the active session", () => {
    render({ agents: [agent("a", "/repo/a")], activeSessionId: "a" });
    expect(container.querySelector("section")).toBeNull();
    render({ agents: [agent("b", "/repo/b")], activeSessionId: "a" });
    expect(container.querySelector("section")).not.toBeNull();
  });

  it("selects an agent from the activity list", () => {
    const onSelect = vi.fn();
    render({
      agents: [agent("a", "/repo/a"), agent("b", "/repo/b")],
      onSelect,
      groupLabels: {},
      groupColors: {},
      groupCustomColors: {},
      groupMascots: {},
    });

    act(() =>
      container
        .querySelector<HTMLButtonElement>('[data-live-agent-card="b"]')!
        .click(),
    );
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("b");
  });

  it("keeps elapsed timers out of its live region", () => {
    render({
      agents: [agent("a", "/repo/a"), agent("b", "/repo/b")],
      groupLabels: {},
      groupColors: {},
      groupCustomColors: {},
      groupMascots: {},
    });

    const liveRegion = container.querySelector('[aria-live="polite"]')!;
    expect(liveRegion.textContent).toBe("2 working agents");
    expect(liveRegion.textContent).not.toMatch(/\d+s/);
    expect(container.querySelector("[role=status]")).toBeNull();
  });

  it("shows an agent resting on background tasks with its task", () => {
    const resting = {
      id: "b",
      busy: true,
      backgroundTasks: ["npm run dev"],
    } as Session;
    render(
      { agents: [agent("a", "/repo/a"), agent("b", "/repo/b")] },
      [resting],
    );

    const card = (id: string) =>
      container.querySelector<HTMLElement>(`[data-live-agent-card="${id}"]`)!;
    expect(card("a").getAttribute("aria-label")).toContain("Working");
    expect(card("b").getAttribute("aria-label")).toContain("[bg] npm run dev");
    expect(card("b").querySelector(".animate-pulse")).not.toBeNull();
  });
});
