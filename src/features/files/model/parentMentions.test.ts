import { describe, expect, it, vi } from "vitest";
import { loadProjectFiles } from "./fileIndex";
import { applyFileMentionsToTurn } from "./fileMentions";
import { parentMentionQuery, rankParentEntries } from "./parentMentions";

vi.mock("./fileIndex", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./fileIndex")>();
  return {
    ...actual,
    loadProjectFiles: vi.fn(actual.loadProjectFiles),
  };
});

const list = vi.mocked(loadProjectFiles);

describe("parent directory mentions", () => {
  it("resolves the listed directory against the working directory", () => {
    expect(parentMentionQuery("../", "/a/b/proj")).toEqual({
      dir: "/a/b",
      prefix: "../",
      filter: "",
    });
    expect(parentMentionQuery("../../x/ba", "/a/b/proj")).toEqual({
      dir: "/a/x",
      prefix: "../../x/",
      filter: "ba",
    });
    expect(parentMentionQuery("src/", "/a/b/proj")).toBeNull();
  });

  it("lists folders first and writes the full label", () => {
    const entries = [
      { name: "z.md", path: "/a/z.md", isDir: false, ignored: false },
      { name: "lib", path: "/a/lib", isDir: true, ignored: false },
    ];
    expect(rankParentEntries(entries, "../", "").map((f) => f.relative)).toEqual([
      "../lib",
      "../z.md",
    ]);
    expect(rankParentEntries(entries, "../", "z").map((f) => f.relative)).toEqual([
      "../z.md",
    ]);
  });

  it("spells out the absolute path of a parent mention", async () => {
    list.mockResolvedValueOnce([]);
    expect(await applyFileMentionsToTurn("see @../x/y.ts.", "/a/proj")).toContain(
      "- @../x/y.ts → /a/x/y.ts",
    );
  });
});
