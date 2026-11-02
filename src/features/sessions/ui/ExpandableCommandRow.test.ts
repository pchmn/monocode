// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Block } from "../model/session";
import { AgentTranscript } from "./AgentTranscript";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const command = (id: string, text: string, detail: string): Block => ({
  id,
  role: "tool",
  text,
  tool: { kind: "execute", status: "completed", detail },
});

describe("expandable command rows", () => {
  it("opens each grouped command onto its full text and output", () => {
    const blocks: Block[] = [
      { id: "user", role: "user", text: "Push it" },
      command("push", "git push origin feat/x", "Everything up-to-date"),
      command(
        "pr",
        "gh pr create --title demo",
        "https://github.com/x/y/pull/1",
      ),
    ];

    act(() =>
      root.render(createElement(AgentTranscript, { blocks, busy: true })),
    );

    const triggers = container.querySelectorAll<HTMLButtonElement>(
      'button[aria-label^="Show command details for"]',
    );
    expect(triggers).toHaveLength(2);
    expect(container.textContent).not.toContain("Everything up-to-date");

    act(() => triggers[0].click());
    expect(triggers[0].getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain("Everything up-to-date");
    expect(container.textContent).not.toContain("pull/1");

    act(() => triggers[0].click());
    expect(container.textContent).not.toContain("Everything up-to-date");
  });
});
