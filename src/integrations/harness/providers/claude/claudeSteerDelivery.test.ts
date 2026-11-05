import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sent: string[] = [];
let onLine: ((line: string) => void) | undefined;

vi.mock("../../core/child", () => ({
  resolveClaudeBinary: async () => ({ path: "/fake/claude" }),
  spawnChild: async () => undefined,
  killChild: async () => undefined,
  unwatchChild: () => undefined,
  watchChild: (_id: string, line: (l: string) => void) => {
    onLine = line;
  },
  writeChild: async (_id: string, line: string) => {
    sent.push(line);
  },
  hasHeadlessChildBackend: () => false,
}));

const {
  sendClaudeTurn,
  steerClaudeTurn,
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

async function startTurn() {
  const events: HarnessEvent[] = [];
  let done = false;
  const turn = sendClaudeTurn({
    sessionId: "s1",
    cwd: "/repo",
    model: "claude:claude-sonnet-5",
    modelSettings: {},
    runtimeMode: "supervised",
    text: "run the dev server",
    attachments: [],
    onEvent: (event) => events.push(event),
  }).then(() => {
    done = true;
  });
  await waitFor(() =>
    parse().some(
      (m) =>
        (m.request as { subtype?: string } | undefined)?.subtype ===
        "initialize",
    ),
  );
  emit({ type: "system", subtype: "init", session_id: "sess_1" });
  emit({
    type: "control_response",
    response: { subtype: "success", request_id: "monocode_1" },
  });
  await waitFor(() => parse().some((m) => m.type === "user"));
  return { events, turn, isDone: () => done };
}

const steer = (id?: string) =>
  steerClaudeTurn({
    sessionId: "s1",
    cwd: "/repo",
    model: "claude:claude-sonnet-5",
    text: "also check the footer",
    id,
  });

const lifecycle = (id: string, state: string) =>
  emit({
    type: "command_lifecycle",
    command_uuid: id,
    state,
    session_id: "sess_1",
  });
const result = () =>
  emit({ type: "result", subtype: "success", session_id: "sess_1" });

beforeEach(() => {
  sent.length = 0;
  onLine = undefined;
  __claudeTestReset();
});

afterEach(async () => {
  await stopClaudeSession("s1");
  __claudeTestReset();
});

describe("claude steer delivery", () => {
  it("tags the steer and reports when Claude queues and reads it", async () => {
    const { events, turn } = await startTurn();
    await steer("block-1");
    expect(parse().at(-1)).toMatchObject({ type: "user", uuid: "block-1" });

    lifecycle("block-1", "queued");
    lifecycle("block-1", "started");
    result();
    await turn;

    expect(events.filter((event) => event.type.startsWith("steer."))).toEqual([
      { type: "steer.queued", id: "block-1" },
      { type: "steer.delivered", id: "block-1" },
    ]);
  });

  it("keeps the turn open while Claude still holds an unread steer", async () => {
    const { turn, isDone } = await startTurn();
    await steer("block-1");
    lifecycle("block-1", "queued");
    result();
    await tick();
    expect(isDone()).toBe(false);

    lifecycle("block-1", "started");
    result();
    await turn;
    expect(isDone()).toBe(true);
  });

  it("ends the turn normally when Claude reports no lifecycle", async () => {
    const { events, turn } = await startTurn();
    await steer("block-1");
    result();
    await turn;
    expect(events.some((event) => event.type.startsWith("steer."))).toBe(false);
  });

  it("ignores lifecycle lines for messages it did not steer", async () => {
    const { events, turn } = await startTurn();
    lifecycle("someone-else", "queued");
    result();
    await turn;
    expect(events.some((event) => event.type.startsWith("steer."))).toBe(false);
  });
});
