import { beforeEach, describe, expect, it, vi } from "vitest";

const listings = new Map<string, { name: string; path: string; relative: string }[]>();
const folders = [
  { path: "/ws/api", name: "api" },
  { path: "/ws/web", name: "web" },
];

vi.mock("../../files/model/fileIndex", () => ({
  peekProjectFiles: (cwd: string) => listings.get(cwd) ?? null,
  loadProjectFiles: async (cwd: string) => listings.get(cwd) ?? [],
}));
vi.mock("./codeWorkspace", () => ({
  isCodeWorkspace: (path: string) => path.endsWith(".code-workspace"),
  codeWorkspaceFolders: () => folders,
}));
vi.mock("./workspaceFolderWorktrees", () => ({
  workspaceFolderOf: (_: string, path: string) =>
    path === "/wt/api-branch" ? "/ws/api" : undefined,
  foldersInWorktree: (
    list: typeof folders,
    owner: string | undefined,
    cwd: string,
  ) => list.map((f) => (f.path === owner ? { ...f, path: cwd } : f)),
}));

import { loadSearchFiles, peekSearchFiles } from "./workspaceFileIndex";

const file = (root: string, relative: string) => ({
  name: relative.split("/").pop()!,
  path: `${root}/${relative}`,
  relative,
});

describe("workspace file search", () => {
  beforeEach(() => {
    listings.clear();
    listings.set("/ws/api", [file("/ws/api", "src/index.ts")]);
    listings.set("/ws/web", [file("/ws/web", "config.json")]);
    listings.set("/wt/api-branch", [file("/wt/api-branch", "src/new.ts")]);
  });

  it("lists every folder's files under the folder name", async () => {
    const files = await loadSearchFiles("/ws/api", "/ws/silbo.code-workspace");
    expect(files.map((f) => f.relative)).toEqual([
      "api/src/index.ts",
      "web/config.json",
    ]);
  });

  it("searches the session's worktree in place of its folder", async () => {
    const files = await loadSearchFiles("/wt/api-branch", "/ws/silbo.code-workspace");
    expect(files.map((f) => f.path)).toEqual([
      "/wt/api-branch/src/new.ts",
      "/ws/web/config.json",
    ]);
  });

  it("keeps a single project's own index", () => {
    expect(peekSearchFiles("/ws/api", "/ws/api")).toBe(listings.get("/ws/api"));
    expect(peekSearchFiles("/ws/api")).toBe(listings.get("/ws/api"));
  });

  it("peeks whichever folders are already indexed", () => {
    listings.delete("/ws/web");
    expect(
      peekSearchFiles("/ws/api", "/ws/silbo.code-workspace")?.map((f) => f.relative),
    ).toEqual(["api/src/index.ts"]);
    listings.delete("/ws/api");
    expect(peekSearchFiles("/ws/api", "/ws/silbo.code-workspace")).toBeNull();
  });
});
