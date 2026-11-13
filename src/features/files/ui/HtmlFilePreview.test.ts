import { describe, expect, it } from "vitest";
import { isHtmlFilePath } from "./HtmlFilePreview";

describe("isHtmlFilePath", () => {
  it("matches .html and .htm in any case", () => {
    expect(isHtmlFilePath("/repo/report.html")).toBe(true);
    expect(isHtmlFilePath("/repo/OLD.HTM")).toBe(true);
  });

  it("ignores other files", () => {
    expect(isHtmlFilePath("/repo/page.html.md")).toBe(false);
    expect(isHtmlFilePath("/repo/template.xhtml")).toBe(false);
    expect(isHtmlFilePath("/repo/html")).toBe(false);
  });
});
