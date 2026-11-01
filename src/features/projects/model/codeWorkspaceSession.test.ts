import { describe, expect, it, vi } from "vitest";

vi.mock("../../../platform/tauri/fs", () => ({
  readTextFile: async () =>
    '{ "folders": [{ "path": "api" }, { "path": "web" }] }',
}));

import { isWorkspaceFolderPending, loadCodeWorkspace } from "./codeWorkspace";
import { newSession, sessionWorkCwd } from "../../sessions/model/session";

describe("workspace sessions", () => {
  it("start in the first folder and wait for the user to confirm it", async () => {
    const file = "/me/sabri/sabri.code-workspace";
    await loadCodeWorkspace(file);
    const session = newSession("claude", file);
    expect(session.cwd).toBe(file);
    expect(session.worktreeCwd).toBe("/me/sabri/api");
    expect(isWorkspaceFolderPending(session.id)).toBe(true);
    expect(sessionWorkCwd({ cwd: file })).toBe("/me/sabri/api");
  });
});
