import { describe, expect, it } from "vitest";
import type { Attachment } from "../model/session";
import { galleryImages, stepIndex } from "./ImageGallery";

const image = (id: string) =>
  ({ id, name: id, kind: "image", previewUrl: `blob:${id}` }) as unknown as Attachment;

describe("galleryImages", () => {
  it("keeps only the previewable images of the message", () => {
    const a = image("a");
    const b = image("b");
    const doc = { id: "doc", kind: "file" } as Attachment;
    expect(galleryImages(b, [a, doc, b]).map((file) => file.id)).toEqual(["a", "b"]);
  });

  it("falls back to the opened image alone when it is not in the list", () => {
    const a = image("a");
    expect(galleryImages(a, [])).toEqual([a]);
  });
});

describe("stepIndex", () => {
  it("wraps around both ends", () => {
    expect(stepIndex(0, -1, 3)).toBe(2);
    expect(stepIndex(2, 1, 3)).toBe(0);
  });
});
