import { describe, expect, it } from "vitest";
import type { SessionSummary } from "../data/sessionStore";
import { buildSessionListWithInactive } from "./inactiveSessions";
import { sessionListNavigationIds, ungroupedSessions } from "./sessionFolders";

function summary(id: string, overrides: Partial<SessionSummary> = {}) {
  return {
    id,
    cwd: "/tmp/project",
    harness: "cursor",
    model: "gpt-5",
    runtimeMode: "supervised",
    title: `cursor · ${id}`,
    createdAt: 1,
    updatedAt: 1,
    additions: 0,
    deletions: 0,
    ...overrides,
  } as SessionSummary;
}

describe("buildSessionListWithInactive", () => {
  it("groups loose sessions without an open tab last and skips them in navigation while collapsed", () => {
    const sessions = [
      summary("open"),
      summary("closed"),
      summary("pin", { pinned: true }),
    ];
    const loose = ungroupedSessions(sessions, []);
    const build = (inactive?: { collapsed: boolean }) =>
      buildSessionListWithInactive(
        sessions,
        [],
        loose,
        false,
        undefined,
        inactive && { activeIds: new Set(["open"]), ...inactive },
      );
    const entries = build({ collapsed: true });
    expect(entries.map((entry) => entry.kind)).toEqual([
      "pinned",
      "session",
      "inactive",
    ]);
    expect(sessionListNavigationIds(entries, false)).toEqual(["pin", "open"]);
    expect(sessionListNavigationIds(entries, true)).toEqual([
      "pin",
      "open",
      "closed",
    ]);
    expect(build().map((entry) => entry.kind)).toEqual([
      "pinned",
      "session",
      "session",
    ]);
  });
});
