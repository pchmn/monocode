import { expect, it } from "vitest";
import { registerHarness, sendHarnessTurn, type HarnessAdapter } from "./registry";
import { moveHarnessSession } from "./sessionMoves";

function recordingClaude(calls: string[]): HarnessAdapter {
  return {
    id: "claude",
    live: true,
    async sendTurn(input) {
      calls.push(`send ${input.cwd}`);
    },
    async steerTurn() {},
    async cancelTurn() {},
    respondApproval() {},
    async stopSession(id) {
      calls.push(`stop ${id}`);
    },
    async forgetSession() {},
    bindSession(threadId, providerSessionId, cwd) {
      calls.push(`bind ${threadId} ${providerSessionId} ${cwd}`);
    },
  };
}

const send = (sessionId: string, cwd: string) =>
  sendHarnessTurn({
    harness: "claude",
    sessionId,
    cwd,
    model: "claude:opus",
    runtimeMode: "supervised",
    text: "next",
    onEvent: () => undefined,
  });

it("resumes a moved session in its new cwd before the next turn, once", async () => {
  const calls: string[] = [];
  registerHarness(recordingClaude(calls));
  moveHarnessSession("s1", "/repo/.worktrees/x", () => ({ providerSessionId: "p1" }));
  await send("s1", "/repo/.worktrees/x");
  await send("s1", "/repo/.worktrees/x");
  expect(calls).toEqual([
    "stop s1",
    "bind s1 p1 /repo/.worktrees/x",
    "send /repo/.worktrees/x",
    "send /repo/.worktrees/x",
  ]);
});

it("leaves the session alone when the next turn runs elsewhere", async () => {
  const calls: string[] = [];
  registerHarness(recordingClaude(calls));
  moveHarnessSession("s2", "/repo/.worktrees/x", () => ({ providerSessionId: "p1" }));
  await send("s2", "/repo");
  expect(calls).toEqual(["send /repo"]);
});
