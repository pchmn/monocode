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
  it("groups agents by project in order of their first agent", () => {
    render({
      agents: [
        agent("a-1", "/repo/a"),
        agent("b-1", "/repo/b", { needsApproval: true }),
        agent("a-2", "/repo/a"),
        agent("b-2", "/repo/b"),
        agent("c-1", "/repo/c"),
      ],
      groupLabels: { "/repo/a": "Alpha", "/repo/b": "Beta" },
      groupColors: {},
      groupCustomColors: {},
      groupMascots: {},
    });

    const headers = Array.from(
      container.querySelectorAll<HTMLElement>("[data-working-group]"),
    );
    expect(headers.map((header) => header.textContent)).toEqual([
      "Alpha2",
      "Beta2",
      "c1",
    ]);
    const cards = Array.from(
      container.querySelectorAll<HTMLElement>("[data-live-agent-card]"),
    );
    expect(cards.map((card) => card.dataset.liveAgentCard)).toEqual([
      "a-1",
      "a-2",
      "b-1",
      "b-2",
      "c-1",
    ]);
    expect(cards[0].textContent).not.toContain("Alpha");
    expect(cards[0].querySelector(".mascot-active")).not.toBeNull();
  });

  it("folds a project group and keeps its approval visible", () => {
    render({
      agents: [
        agent("b-1", "/repo/b", { needsApproval: true }),
        agent("a-1", "/repo/a"),
      ],
      groupLabels: { "/repo/a": "Alpha", "/repo/b": "Beta" },
    });

    const beta = container.querySelector<HTMLElement>(
      '[data-working-group="/repo/b"]',
    )!;
    act(() => beta.click());
    expect(beta.getAttribute("aria-expanded")).toBe("false");
    expect(beta.querySelector('[aria-label="Needs approval"]')).not.toBeNull();
    const cards = Array.from(
      container.querySelectorAll<HTMLElement>("[data-live-agent-card]"),
    );
    expect(cards.map((card) => card.dataset.liveAgentCard)).toEqual(["a-1"]);
  });

  it("lists a single project flat, with the project on each card", () => {
    render({
      agents: [agent("a-1", "/repo/a"), agent("a-2", "/repo/a")],
      groupLabels: { "/repo/a": "Alpha" },
    });

    expect(container.querySelector("[data-working-group]")).toBeNull();
    expect(
      container.querySelector("[data-live-agent-card]")?.textContent,
    ).toContain("Alpha");
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
    expect(card("a").textContent).toContain("Working");
    expect(card("b").textContent).toContain("[bg] npm run dev");
    expect(card("b").querySelector(".animate-pulse")).not.toBeNull();
  });
});
