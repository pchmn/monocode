import { describe, expect, it } from "vitest";
import type { Attachment } from "../model/session";
import { sentTokenImage } from "./SentImageTokens";

const image = (id: string, imageNumber?: number) =>
  ({ id, kind: "image", imageNumber }) as Attachment;

describe("sentTokenImage", () => {
  it("matches by number while the turn is live", () => {
    const files = [image("a", 2), image("b", 3)];
    expect(sentTokenImage(3, files)?.id).toBe("b");
    expect(sentTokenImage(1, files)).toBeUndefined();
  });

  it("falls back to image order once numbers were not saved", () => {
    const files = [{ id: "doc", kind: "file" } as Attachment, image("a"), image("b")];
    expect(sentTokenImage(2, files)?.id).toBe("b");
  });
});
