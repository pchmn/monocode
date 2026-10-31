import { describe, expect, it } from "vitest";
import type { Attachment } from "../model/session";
import { atomicTokenEdit, imageAtCaret } from "./inlineImagePaste";

const v = "a [Image #2] b";
// token spans 2..12

describe("atomicTokenEdit", () => {
  it("Backspace after the token removes it and the trailing space", () => {
    expect(atomicTokenEdit(v, 12, 12, "Backspace")).toEqual({
      value: "a b",
      start: 2,
      end: 2,
    });
  });
  it("Backspace inside the token removes it whole", () => {
    expect(atomicTokenEdit(v, 8, 8, "Backspace")?.value).toBe("a b");
  });
  it("Backspace before the token is native", () => {
    expect(atomicTokenEdit(v, 2, 2, "Backspace")).toBeNull();
  });
  it("Delete before or inside removes it, after is native", () => {
    expect(atomicTokenEdit(v, 2, 2, "Delete")?.value).toBe("a b");
    expect(atomicTokenEdit(v, 5, 5, "Delete")?.value).toBe("a b");
    expect(atomicTokenEdit(v, 12, 12, "Delete")).toBeNull();
  });
  it("keeps the preceding space when the token ends the text", () => {
    expect(atomicTokenEdit("a [Image #1]", 12, 12, "Backspace")?.value).toBe(
      "a ",
    );
  });
  it("expands a partial selection to the whole token", () => {
    expect(atomicTokenEdit(v, 0, 5, "Backspace")?.value).toBe("b");
    expect(atomicTokenEdit(v, 5, 14, "Delete")?.value).toBe("a ");
  });
  it("leaves selections that avoid token interiors alone", () => {
    expect(atomicTokenEdit(v, 0, 2, "Backspace")).toBeNull();
  });
  it("arrows jump over the token", () => {
    expect(atomicTokenEdit(v, 12, 12, "ArrowLeft")).toMatchObject({ start: 2 });
    expect(atomicTokenEdit(v, 2, 2, "ArrowRight")).toMatchObject({ start: 12 });
    expect(atomicTokenEdit(v, 0, 0, "ArrowRight")).toBeNull();
  });
});

describe("imageAtCaret", () => {
  const file = { id: "x", imageNumber: 2 } as Attachment;
  it("finds the attachment only for a caret inside the token", () => {
    expect(imageAtCaret(v, 6, [file])).toBe(file);
    expect(imageAtCaret(v, 2, [file])).toBeUndefined();
    expect(imageAtCaret(v, 12, [file])).toBeUndefined();
    expect(imageAtCaret(v, 6, [])).toBeUndefined();
  });
});
