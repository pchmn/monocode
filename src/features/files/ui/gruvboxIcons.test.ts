import { describe, expect, it } from "vitest";
import { type GruvboxIcons, gruvboxSvg } from "./gruvboxIcons";

const icons: GruvboxIcons = {
  files: { "package.json": "nodejs" },
  exts: { ts: "typescript", "d.ts": "typescript-def" },
  folders: { src: "folder-src" },
  svgs: {
    nodejs: "N",
    typescript: "T",
    "typescript-def": "D",
    "folder-src": "S",
    file: "F",
    folder: "O",
  },
};

describe("gruvboxSvg", () => {
  it("matches by file name, then compound extension", () => {
    expect(gruvboxSvg(icons, "package.json", false, "nodejs")).toBe("N");
    expect(gruvboxSvg(icons, "a.d.ts", false, "x")).toBe("D");
    expect(gruvboxSvg(icons, "A.TS", false, "x")).toBe("T");
  });

  it("matches folders by name", () => {
    expect(gruvboxSvg(icons, "src", true, "folder-src-open")).toBe("S");
  });

  it("uses the gruvbox default only when Material also has no specific icon", () => {
    expect(gruvboxSvg(icons, "a.zzz", false, "file")).toBe("F");
    expect(gruvboxSvg(icons, "lib", true, "folder-open")).toBe("O");
    expect(gruvboxSvg(icons, "a.rs", false, "rust")).toBe("");
  });
});
