import { describe, expect, it } from "vitest";
import { inlineCodeUrl } from "./inlineCodeUrl";

describe("inlineCodeUrl", () => {
  it("keeps explicit web URLs", () => {
    expect(inlineCodeUrl("https://example.com/a?b=1")).toBe(
      "https://example.com/a?b=1",
    );
    expect(inlineCodeUrl("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("turns bare domains into https URLs", () => {
    expect(inlineCodeUrl("console.preview.kipense.com")).toBe(
      "https://console.preview.kipense.com",
    );
    expect(inlineCodeUrl("kipense.fr/console/x")).toBe(
      "https://kipense.fr/console/x",
    );
    expect(inlineCodeUrl("my-app.vercel.app:8443")).toBe(
      "https://my-app.vercel.app:8443",
    );
  });

  it("leaves file names and paths alone", () => {
    for (const text of [
      "package.json",
      "README.md",
      "install.sh",
      "src/main.rs",
      "archive.zip",
      "MonoCode.app",
      "Foo.Com",
      "/console/*",
      "CONSOLE_SECRET",
      "a b.com",
      "",
    ]) {
      expect(inlineCodeUrl(text), text).toBeUndefined();
    }
  });
});
