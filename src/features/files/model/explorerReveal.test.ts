import { describe, expect, it } from "vitest";
import { revealDirs } from "./explorerReveal";

describe("revealDirs", () => {
  it("lists the folders from the root down to the file's parent", () => {
    expect(revealDirs("/repo", "/repo/web/src/a.ts")).toEqual([
      "/repo",
      "/repo/web",
      "/repo/web/src",
    ]);
  });

  it("expands only the root for a top-level file", () => {
    expect(revealDirs("/repo/", "/repo/a.ts")).toEqual(["/repo"]);
  });

  it("ignores the root itself and paths outside it", () => {
    expect(revealDirs("/repo", "/repo")).toBeNull();
    expect(revealDirs("/repo", "/repo-other/a.ts")).toBeNull();
    expect(revealDirs("/repo", "/elsewhere/a.ts")).toBeNull();
  });
});
