import { describe, expect, it } from "vitest";
import { interleaveAttachments } from "./inlineImages";
import type { Attachment } from "./session";

describe("interleaveAttachments", () => {
  const image = (id: string, imageNumber?: number): Attachment => ({
    id,
    name: `${id}.png`,
    mimeType: "image/png",
    kind: "image",
    size: 1,
    imageNumber,
  });
  const run = (text: string, files: Attachment[]) =>
    interleaveAttachments(text, files, (t) => t, (file) => file.id);

  it("places each numbered image right after its token", () => {
    expect(
      run("compare [Image #2] with [Image #1] please", [
        image("a", 1),
        image("b", 2),
        image("c"),
      ]),
    ).toEqual([
      "compare [Image #2]",
      "b",
      "with [Image #1]",
      "a",
      "please",
      "c",
    ]);
  });

  it("keeps text first when there are no tokens", () => {
    expect(run("look", [image("a")])).toEqual(["look", "a"]);
  });

  it("leaves unknown or repeated tokens as text", () => {
    expect(run("[Image #1] [Image #1] [Image #9]", [image("a", 1)])).toEqual([
      "[Image #1]",
      "a",
      "[Image #1] [Image #9]",
    ]);
  });
});
