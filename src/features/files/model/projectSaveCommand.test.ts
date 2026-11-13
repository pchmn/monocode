// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
const ask = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ ask }));

const found = {
  settingsPath: "/repo/.monocode/settings.json",
  settingsHash: "v1",
  root: "/repo",
  commands: ["rustfmt ${file}"],
  command: "rustfmt '/repo/a.rs'",
};

async function load() {
  vi.resetModules();
  return import("./projectSaveCommand");
}

beforeEach(() => {
  localStorage.clear();
  invoke.mockReset();
  ask.mockReset();
  invoke.mockImplementation(async (command: string) =>
    command === "project_save_command" ? found : undefined,
  );
});

describe("runProjectSaveCommand", () => {
  it("asks once, then runs the trusted command and reloads", async () => {
    const { runProjectSaveCommand } = await load();
    const reload = vi.fn(async () => {});
    ask.mockResolvedValue(true);

    await Promise.all([
      runProjectSaveCommand("/repo/a.rs", reload),
      runProjectSaveCommand("/repo/a.rs", reload),
    ]);
    await runProjectSaveCommand("/repo/a.rs", reload);

    expect(ask).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("project_run_save_command", {
      root: "/repo",
      command: found.command,
    });
    expect(reload).toHaveBeenCalledTimes(3);
  });

  it("asks again when the settings file changes", async () => {
    const { runProjectSaveCommand } = await load();
    ask.mockResolvedValue(true);
    await runProjectSaveCommand("/repo/a.rs", async () => {});
    found.settingsHash = "v2";
    try {
      await runProjectSaveCommand("/repo/a.rs", async () => {});
    } finally {
      found.settingsHash = "v1";
    }
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it("skips declined commands without asking again this session", async () => {
    const { runProjectSaveCommand } = await load();
    const reload = vi.fn(async () => {});
    ask.mockResolvedValue(false);

    expect(await runProjectSaveCommand("/repo/a.rs", reload)).toBeNull();
    expect(await runProjectSaveCommand("/repo/a.rs", reload)).toBeNull();

    expect(ask).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalledWith(
      "project_run_save_command",
      expect.anything(),
    );
  });

  it("returns the command failure and leaves remote files alone", async () => {
    const { runProjectSaveCommand, hasProjectSaveCommand } = await load();
    ask.mockResolvedValue(true);
    invoke.mockImplementation(async (command: string) => {
      if (command === "project_save_command") return found;
      throw "`rustfmt` exited with 1: boom";
    });

    expect(await runProjectSaveCommand("/repo/a.rs", async () => {})).toBe(
      "`rustfmt` exited with 1: boom",
    );
    expect(await hasProjectSaveCommand("remote://host/repo/a.rs")).toBe(false);
    expect(invoke).not.toHaveBeenCalledWith("project_save_command", {
      path: "remote://host/repo/a.rs",
    });
  });
});
