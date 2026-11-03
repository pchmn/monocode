// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

const fs = vi.hoisted(() => ({
  listSkills: vi.fn(),
  readTextFile: vi.fn(),
}));
vi.mock("../../../../platform/tauri/fs", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listSkills: fs.listSkills,
  readTextFile: fs.readTextFile,
}));

import {
  claudeCommandProvider,
  claudeCommandsFromControlResponse,
  noteClaudeCommands,
  withClaudeDiskSkills,
} from "./claudeCommands";

function initializeResponse(commands: unknown[]) {
  return {
    type: "control_response",
    response: { subtype: "success", request_id: "1", response: { commands } },
  };
}

const diskSkill = (name: string, source = "agents") => ({
  name,
  description: `${name} skill`,
  path: `/home/.${source}/skills/${name}/SKILL.md`,
  scope: "user",
  source,
});

beforeEach(() => {
  localStorage.clear();
  fs.listSkills.mockReset();
  fs.readTextFile.mockReset();
  fs.listSkills.mockResolvedValue([]);
});

describe("claudeCommandsFromControlResponse", () => {
  it("keeps CLI commands and drops the ones MonoCode owns or the TUI needs", () => {
    const commands = claudeCommandsFromControlResponse(
      initializeResponse([
        { name: "context", description: "Show context usage" },
        { name: "simplify", description: "Simplify", argumentHint: "[focus]" },
        { name: "clear", description: "Clear" },
        { name: "color", description: "Color" },
        { name: "__remote-workflow", description: "internal" },
        { name: "context", description: "duplicate" },
      ]),
    );
    expect(commands?.map((c) => c.name)).toEqual(["context", "simplify"]);
    expect(commands?.[1]).toMatchObject({
      invocation: "simplify",
      source: "claude",
      inputHint: "[focus]",
    });
  });

  it("ignores control responses without a command list", () => {
    expect(
      claudeCommandsFromControlResponse({
        type: "control_response",
        response: { subtype: "success", response: {} },
      }),
    ).toBeNull();
  });
});

describe("claudeCommandProvider", () => {
  it("falls back to disk skills before the CLI reports its commands", async () => {
    fs.listSkills.mockResolvedValue([diskSkill("retro", "claude")]);
    const commands = await claudeCommandProvider.discover({
      cwd: "/repo",
      sessionId: "cold",
    });
    expect(commands.map((c) => c.name)).toEqual(["create-skill", "retro"]);
  });

  it("puts CLI commands first and adds disk skills the CLI does not know", async () => {
    noteClaudeCommands(
      "s1",
      initializeResponse([
        { name: "retro", description: "CLI retro" },
        { name: "context", description: "Context" },
      ]),
    );
    fs.listSkills.mockResolvedValue([
      diskSkill("retro", "claude"),
      diskSkill("visual-explainer"),
    ]);
    const commands = await claudeCommandProvider.discover({
      cwd: "/repo",
      sessionId: "s1",
    });
    expect(commands.map((c) => [c.name, c.description])).toEqual([
      ["retro", "CLI retro"],
      ["context", "Context"],
      ["visual-explainer", "visual-explainer skill"],
      ["create-skill", expect.any(String)],
    ]);
  });

  it("hides CLI entries for skills disabled in Settings", async () => {
    noteClaudeCommands("s2", initializeResponse([{ name: "retro" }]));
    const retro = diskSkill("retro", "claude");
    fs.listSkills.mockResolvedValue([retro]);
    localStorage.setItem(
      "monocode.disabledSkillPaths",
      JSON.stringify([retro.path]),
    );
    const commands = await claudeCommandProvider.discover({
      cwd: "/repo",
      sessionId: "s2",
    });
    expect(commands.map((c) => c.name)).not.toContain("retro");
  });

  it("pushes the merged list when the session reports its commands", async () => {
    const onCommands = vi.fn();
    const stop = claudeCommandProvider.subscribe!(
      { cwd: "/repo", sessionId: "s3" },
      onCommands,
    );
    noteClaudeCommands("s3", initializeResponse([{ name: "usage" }]));
    await vi.waitFor(() => expect(onCommands).toHaveBeenCalled());
    expect(onCommands.mock.calls[0]![0].map((c: { name: string }) => c.name))
      .toContain("usage");
    stop();
  });
});

describe("withClaudeDiskSkills", () => {
  it("leaves commands the CLI resolves untouched", async () => {
    noteClaudeCommands("s4", initializeResponse([{ name: "simplify" }]));
    expect(await withClaudeDiskSkills("s4", "/simplify now", "/repo")).toBe(
      "/simplify now",
    );
    expect(fs.listSkills).not.toHaveBeenCalled();
  });

  it("appends the body of a skill only MonoCode knows, after the text", async () => {
    noteClaudeCommands("s5", initializeResponse([{ name: "simplify" }]));
    const skill = diskSkill("visual-explainer");
    fs.listSkills.mockResolvedValue([skill]);
    fs.readTextFile.mockResolvedValue("Draw a diagram.");
    const text = await withClaudeDiskSkills(
      "s5",
      "/simplify then /visual-explainer",
      "/repo",
    );
    expect(text.startsWith("/simplify then /visual-explainer\n")).toBe(true);
    expect(text).toContain("## /visual-explainer\n\nDraw a diagram.");
    expect(text).toContain(skill.path);
  });
});
