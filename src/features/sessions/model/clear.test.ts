import { describe, expect, it, vi } from "vitest";

vi.mock("../../../platform/tauri/fs", () => ({
  readTextFile: async () => '{ "folders": [{ "path": "api" }, { "path": "web" }] }',
}));

import {
  isWorkspaceFolderPending,
  loadCodeWorkspace,
  setWorkspaceFolderPending,
} from "../../projects/model/codeWorkspace";
import { clearedSession, isClearCommand } from "./clear";
import { newSession } from "./session";

const workspace = "/me/sabri/sabri.code-workspace";

describe("clear command", () => {
  it("matches a standalone /clear command", () => {
    expect(isClearCommand("/clear")).toBe(true);
    expect(isClearCommand("  /CLEAR\n")).toBe(true);
  });

  it("does not consume ordinary prompt text", () => {
    expect(isClearCommand("/clear now")).toBe(false);
    expect(isClearCommand("mention /clear in docs")).toBe(false);
    expect(isClearCommand("/clearance")).toBe(false);
  });

  it("keeps the workspace folder without asking for it again", async () => {
    await loadCodeWorkspace(workspace);
    const session = { ...newSession("claude", workspace), worktreeCwd: "/me/sabri/web" };
    setWorkspaceFolderPending(session.id, false);
    const fresh = clearedSession(session);
    expect(fresh.worktreeCwd).toBe("/me/sabri/web");
    expect(isWorkspaceFolderPending(fresh.id)).toBe(false);
  });

  it("still asks when the cleared session never confirmed its folder", async () => {
    await loadCodeWorkspace(workspace);
    const session = newSession("claude", workspace);
    expect(isWorkspaceFolderPending(session.id)).toBe(true);
    expect(isWorkspaceFolderPending(clearedSession(session).id)).toBe(true);
  });
});
