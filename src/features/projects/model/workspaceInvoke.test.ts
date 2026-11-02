import { beforeEach, describe, expect, it, vi } from "vitest";

const tauriInvoke = vi.fn(async (_cmd: string, args?: { cwd?: string }) =>
  args?.cwd === "/me/web" ? ["me/web", "me/shared"] : ["me/api", "me/shared"],
);
vi.mock("@tauri-apps/api/core", () => ({ invoke: tauriInvoke }));
vi.mock("../../../platform/tauri/fs", () => ({
  readTextFile: async () =>
    '{ "folders": [{ "path": "api" }, { "path": "web" }] }',
}));

const { invoke } = await import("./workspaceInvoke");
const { workspaceRepoOptions } =
  await import("../../inbox/model/workspaceRepos");

describe("workspace invoke", () => {
  beforeEach(() => tauriInvoke.mockClear());

  it("runs a workspace's command in its first folder", async () => {
    await invoke("git_github_repo", { cwd: "/me/app.code-workspace" });
    expect(tauriInvoke).toHaveBeenCalledWith("git_github_repo", {
      cwd: "/me/api",
    });
  });

  it("lists the repositories of every workspace folder once", async () => {
    await expect(
      invoke("git_github_repositories", { cwd: "/me/app.code-workspace" }),
    ).resolves.toEqual(["me/api", "me/shared", "me/web"]);
    expect(workspaceRepoOptions(["/me/app.code-workspace"])).toEqual([
      "me/api",
      "me/shared",
      "me/web",
    ]);
  });

  it("leaves plain projects and cwd-less commands alone", async () => {
    await invoke("git_github_repo", { cwd: "/me/app" });
    await invoke("git_github_status");
    expect(tauriInvoke).toHaveBeenNthCalledWith(1, "git_github_repo", {
      cwd: "/me/app",
    });
    expect(tauriInvoke).toHaveBeenNthCalledWith(
      2,
      "git_github_status",
      undefined,
    );
  });
});
