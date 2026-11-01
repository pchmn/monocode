import { describe, expect, it } from "vitest";
import { isCodeWorkspace, parseCodeWorkspace } from "./codeWorkspace";

describe("codeWorkspace", () => {
  it("recognises local workspace files only", () => {
    expect(isCodeWorkspace("/Users/me/sabri.code-workspace")).toBe(true);
    expect(isCodeWorkspace("/Users/me/sabri")).toBe(false);
  });

  it("resolves folders from JSONC relative to the file", () => {
    const text = `{
      // VS Code keeps comments
      "folders": [
        { "path": "api" },
        { "path": "../web", "name": "Front" },
        /* absolute */ { "path": "/opt/shared/" },
        { "uri": "vscode-remote://x/y" },
        { "path": "api" },
      ],
      "settings": { "url": "http://a//b" },
    }`;
    expect(
      parseCodeWorkspace(text, "/Users/me/sabri/sabri.code-workspace"),
    ).toEqual([
      { path: "/Users/me/sabri/api", name: "api" },
      { path: "/Users/me/web", name: "Front" },
      { path: "/opt/shared", name: "shared" },
    ]);
  });
});
