// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Block } from "../model/session";
import { ExpandableCommandRow } from "./ExpandableCommandRow";
import { SubagentDetailSheet } from "./SubagentDetailSheet";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const OUTPUT = "/tmp/claude-501/p/s/tasks/b1.output";
const command: Block = {
  id: "toolu_bash",
  role: "tool",
  text: "npm test",
  tool: {
    callId: "toolu_bash",
    title: "npm test",
    kind: "execute",
    status: "completed",
    detail: `Command running in background with ID: b1. Output is being written to: ${OUTPUT}. You will be notified when it completes.`,
  },
};

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  invoke.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function render(block: Block) {
  act(() =>
    root.render(
      createElement(
        "div",
        { "data-session-drop": "s" },
        createElement(ExpandableCommandRow, { block, label: "npm test" }),
        createElement(
          "div",
          { "data-session-composer": "" },
          createElement(SubagentDetailSheet, { blocks: [block] }),
        ),
      ),
    ),
  );
}

const logsButton = () =>
  container.querySelector<HTMLElement>('[aria-label^="Show logs of"]');

it("opens a background command's output file in the sheet", async () => {
  invoke.mockResolvedValue({
    text: "3 passed\n",
    size: 9,
    truncated: false,
    missing: false,
  });
  render(command);
  await act(async () => logsButton()!.click());
  const sheet = container.querySelector('[role="dialog"]');
  expect(sheet?.getAttribute("aria-label")).toBe("Command logs");
  expect(invoke).toHaveBeenCalledWith("read_log_tail", {
    path: OUTPUT,
    sinceSize: undefined,
  });
  expect(sheet?.textContent).toContain("3 passed");
  expect(sheet?.textContent).toContain(OUTPUT);
});

it("offers no logs on a foreground command that prints to its row", () => {
  render({ ...command, tool: { ...command.tool!, detail: "ok" } });
  expect(logsButton()).toBeNull();
});

it("reads the file a foreground command redirects its output to", async () => {
  invoke.mockResolvedValue({
    text: "built\n",
    size: 6,
    truncated: false,
    missing: false,
  });
  const redirected = "cd /repo && npm run build > build.log 2>&1";
  render({
    ...command,
    text: redirected,
    tool: { ...command.tool!, title: redirected, detail: "" },
  });
  await act(async () => logsButton()!.click());
  expect(invoke).toHaveBeenCalledWith("read_log_tail", {
    path: "/repo/build.log",
    sinceSize: undefined,
  });
  expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
    "built",
  );
});
