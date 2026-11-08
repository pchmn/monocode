// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Block } from "../model/session";
import {
  MIN_SHEET_HEIGHT,
  clampSheetHeight,
  savedSheetHeight,
} from "../model/subagentDetail";
import {
  SubagentDetailSheet,
  SubagentDetailsButton,
} from "./SubagentDetailSheet";

const run: Block = {
  id: "agent-1",
  role: "tool",
  text: "Agent: Review the diff",
  tool: { callId: "agent-1", title: "Agent", kind: "agent", status: "pending" },
  agentRun: {
    name: "Review the diff",
    steps: [
      { id: "s1", kind: "message", text: "Looking at the changes." },
      {
        id: "s2",
        kind: "tool",
        text: "npm test",
        toolKind: "execute",
        status: "failed",
        detail: "1 test failed",
      },
    ],
  },
};

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function render(blocks: Block[] = [run]) {
  act(() =>
    root.render(
      createElement(
        "div",
        { "data-session-drop": "s" },
        createElement(SubagentDetailsButton, { block: run }),
        createElement(
          "div",
          { "data-session-composer": "" },
          createElement(SubagentDetailSheet, { blocks }),
          createElement("textarea"),
        ),
        createElement("p", { id: "outside" }, "transcript"),
      ),
    ),
  );
}

const sheet = () => container.querySelector('[role="dialog"]');
const openSheet = () =>
  act(() =>
    container
      .querySelector<HTMLButtonElement>("[data-subagent-details-trigger]")!
      .click(),
  );

it("shows the run's messages, and a failed step with its output", () => {
  render();
  expect(sheet()).toBeNull();
  openSheet();
  expect(sheet()?.textContent).toContain("Looking at the changes.");
  expect(sheet()?.textContent).toContain("npm test");
  expect(sheet()?.textContent).toContain("1 test failed");
});

it("follows the live block from the session", () => {
  render();
  openSheet();
  const steps = [
    ...run.agentRun!.steps,
    { id: "s3", kind: "message" as const, text: "All good now." },
  ];
  render([{ ...run, agentRun: { ...run.agentRun!, steps } }]);
  expect(sheet()?.textContent).toContain("All good now.");
});

it("closes on Escape, on its close button, and on a click outside", () => {
  render();
  openSheet();
  act(() => {
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  });
  expect(sheet()).toBeNull();

  openSheet();
  act(() =>
    container
      .querySelector<HTMLButtonElement>('[aria-label="Close details"]')!
      .click(),
  );
  expect(sheet()).toBeNull();

  openSheet();
  act(() => {
    container
      .querySelector("textarea")!
      .dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  });
  expect(sheet()).not.toBeNull();
  act(() => {
    container
      .querySelector("#outside")!
      .dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  });
  expect(sheet()).toBeNull();
});

it("keeps the height between the minimum and the room above the composer", () => {
  expect(clampSheetHeight(10, 800)).toBe(MIN_SHEET_HEIGHT);
  expect(clampSheetHeight(5000, 800)).toBe(752);
  expect(savedSheetHeight(800)).toBe(360);
  localStorage.setItem("monocode.subagentDetailSheet.height", "500");
  expect(savedSheetHeight(800)).toBe(500);
});
