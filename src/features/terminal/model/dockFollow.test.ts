import { describe, expect, it } from "vitest";
import { createProjectTerminal } from "../../projects/model/projectTerminal";
import { newTerminalFile } from "../../workspace/model/layout";
import { followDockToCwd } from "./dockFollow";

const project = "/ws/silbo.code-workspace";

function dockIn(...cwds: string[]) {
  const [first, ...rest] = cwds.map((cwd) => newTerminalFile(cwd));
  const dock = createProjectTerminal(project, first);
  dock.pane.files.push(...rest);
  return dock;
}

describe("followDockToCwd", () => {
  it("keeps the dock when its active terminal is already in the folder", () => {
    const dock = dockIn("/ws/steevy");
    expect(followDockToCwd(dock, "/ws/steevy")).toBe(dock);
  });

  it("selects an existing terminal opened in the folder", () => {
    const dock = dockIn("/ws/sabri", "/ws/steevy");
    const next = followDockToCwd(dock, "/ws/steevy");
    expect(next.pane.files).toHaveLength(2);
    expect(next.pane.activeFileId).toBe(dock.pane.files[1].id);
  });

  it("opens a terminal in the folder when none is there", () => {
    const dock = dockIn("/ws/sabri");
    const next = followDockToCwd(dock, "/ws/steevy");
    expect(next.pane.files).toHaveLength(2);
    const added = next.pane.files[1];
    expect(added).toMatchObject({ cwd: "/ws/steevy", terminal: true });
    expect(next.pane.activeFileId).toBe(added.id);
  });

  it("matches a terminal on its launch folder after a cd", () => {
    const dock = dockIn("/ws/steevy", "/ws/sabri");
    const onSabri = followDockToCwd(dock, "/ws/sabri");
    const [steevy, sabri] = onSabri.pane.files;
    const moved = {
      ...onSabri,
      pane: {
        ...onSabri.pane,
        files: [{ ...steevy, cwd: "/ws/steevy/src" }, sabri],
      },
    };
    const next = followDockToCwd(moved, "/ws/steevy");
    expect(next.pane.files).toHaveLength(2);
    expect(next.pane.activeFileId).toBe(steevy.id);
  });
});
