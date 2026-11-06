import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sent: string[] = [];
const spawns: string[][] = [];
let onLine: ((line: string) => void) | undefined;
let onExit: ((code: number | null) => void) | undefined;

vi.mock("../../core/child", () => ({
  resolveClaudeBinary: async () => ({ path: "/fake/claude" }),
  spawnChild: async (_id: string, _path: string, args: string[]) => {
    spawns.push(args);
  },
  killChild: async () => undefined,
  unwatchChild: () => undefined,
  watchChild: (
    _id: string,
    line: (l: string) => void,
    exit: (code: number | null) => void,
  ) => {
    onLine = line;
    onExit = exit;
  },
  writeChild: async (_id: string, line: string) => {
    sent.push(line);
  },
  hasHeadlessChildBackend: () => false,
}));

const {
  bindClaudeSession,
  sendClaudeTurn,
  stopClaudeSession,
  __claudeTestReset,
} = await import("./claude");
import type { HarnessEvent } from "../../core/types";

const parse = () =>
  sent.map((line) => JSON.parse(line) as Record<string, unknown>);
const emit = (rec: Record<string, unknown>) => onLine!(JSON.stringify(rec));
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

async function waitFor(pred: () => boolean) {
  for (let i = 0; i < 200 && !pred(); i++) await tick();
  if (!pred()) throw new Error(`timed out; sent=${JSON.stringify(parse())}`);
}

const initializeCount = () =>
  parse().filter(
    (m) =>
      (m.request as { subtype?: string } | undefined)?.subtype === "initialize",
  ).length;

beforeEach(() => {
  sent.length = 0;
  spawns.length = 0;
  onLine = undefined;
  onExit = undefined;
  __claudeTestReset();
});

afterEach(async () => {
  await stopClaudeSession("s1");
  __claudeTestReset();
});

describe("claude missing conversation", () => {
  it("starts a fresh conversation when the bound one was never saved", async () => {
    bindClaudeSession("s1", "stale-id", "/repo");
    const events: HarnessEvent[] = [];
    const turn = sendClaudeTurn({
      sessionId: "s1",
      cwd: "/repo",
      model: "claude:claude-sonnet-5",
      modelSettings: {},
      runtimeMode: "supervised",
      text: "hello",
      attachments: [],
      onEvent: (event) => events.push(event),
    });

    await waitFor(() => initializeCount() === 1);
    expect(spawns[0]).toContain("--resume");
    emit({
      type: "result",
      subtype: "error_during_execution",
      is_error: true,
      session_id: "stale-id",
      errors: ["No conversation found with session ID: stale-id"],
    });
    onExit!(1);

    await waitFor(() => initializeCount() === 2);
    expect(spawns[1]).not.toContain("--resume");
    const fresh = spawns[1][spawns[1].indexOf("--session-id") + 1];
    expect(fresh).not.toBe("stale-id");
    emit({ type: "system", subtype: "init", session_id: fresh });
    emit({
      type: "control_response",
      response: { subtype: "success", request_id: "monocode_1" },
    });
    await waitFor(() => parse().some((m) => m.type === "user"));
    emit({ type: "result", subtype: "success", session_id: fresh });
    await turn;

    expect(events).toContainEqual({
      type: "session.providerBound",
      providerSessionId: fresh,
    });
    expect(events.some((event) => event.type === "session.error")).toBe(false);
  });
});
