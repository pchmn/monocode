// @vitest-environment happy-dom
import type { KeyboardEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { clearOnDoubleEscape } from "./doubleEscapeClear";

function press(field: HTMLTextAreaElement, key: string, timeStamp: number) {
  const preventDefault = vi.fn();
  const e = {
    key,
    timeStamp,
    currentTarget: field,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    preventDefault,
  } as unknown as KeyboardEvent<HTMLTextAreaElement>;
  return { cleared: clearOnDoubleEscape(e, last), preventDefault };
}

const last = { current: 0 };

describe("clearOnDoubleEscape", () => {
  it("clears the draft on a quick second Escape only", () => {
    last.current = 0;
    const field = document.createElement("textarea");
    field.value = "draft";
    const onInput = vi.fn();
    field.addEventListener("input", onInput);
    expect(press(field, "Escape", 1000).cleared).toBe(false);
    expect(field.value).toBe("draft");
    expect(press(field, "Escape", 1300).cleared).toBe(true);
    expect(field.value).toBe("");
    expect(onInput).toHaveBeenCalledOnce();
  });

  it("ignores slow presses, other keys in between and empty drafts", () => {
    last.current = 0;
    const field = document.createElement("textarea");
    field.value = "draft";
    press(field, "Escape", 1000);
    expect(press(field, "Escape", 2000).cleared).toBe(false);
    press(field, "a", 2100);
    expect(press(field, "Escape", 2200).cleared).toBe(false);
    field.value = "";
    press(field, "Escape", 3000);
    expect(press(field, "Escape", 3100).cleared).toBe(false);
  });
});
