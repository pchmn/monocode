// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "./session";

const ask = vi.fn();
vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: (...a: unknown[]) => ask(...a),
}));

const { sessionsToStopOnClose } = await import("./stopOnTabClose");

const session = (id: string, extra: Partial<Session> = {}) =>
  ({ id, title: id, busy: false, ...extra }) as Session;

describe("sessionsToStopOnClose", () => {
  beforeEach(() => {
    ask.mockReset();
    localStorage.clear();
  });

  it("stops an idle agent's background tasks without asking", async () => {
    const sessions = [
      session("bg", { busy: true, backgroundTasks: ["npm run dev"] }),
      session("idle"),
      session("elsewhere", { busy: true }),
    ];
    expect(await sessionsToStopOnClose(sessions, ["bg", "idle"])).toEqual([
      "bg",
    ]);
    expect(ask).not.toHaveBeenCalled();
  });

  it("asks before stopping a working agent, and keeps the tab if refused", async () => {
    const sessions = [session("work", { busy: true })];
    ask.mockResolvedValueOnce(true);
    expect(await sessionsToStopOnClose(sessions, ["work"])).toEqual(["work"]);
    ask.mockResolvedValueOnce(false);
    expect(await sessionsToStopOnClose(sessions, ["work"])).toBeNull();
  });

  it("stops nothing when the setting is off", async () => {
    localStorage.setItem("monocode.stopSessionsOnTabClose", "0");
    const sessions = [session("work", { busy: true })];
    expect(await sessionsToStopOnClose(sessions, ["work"])).toEqual([]);
    expect(ask).not.toHaveBeenCalled();
  });
});
