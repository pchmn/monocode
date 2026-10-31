import type { KeyboardEvent } from "react";

const DOUBLE_ESCAPE_MS = 500;

/** Second Escape within the window clears the draft, like Claude Code. */
export function clearOnDoubleEscape(
  e: KeyboardEvent<HTMLTextAreaElement>,
  lastEscape: { current: number },
): boolean {
  const field = e.currentTarget;
  if (e.key !== "Escape" || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) {
    lastEscape.current = 0;
    return false;
  }
  if (!field.value) return false;
  // The first Escape is left alone so it can still stop a running turn.
  if (e.timeStamp - lastEscape.current > DOUBLE_ESCAPE_MS) {
    lastEscape.current = e.timeStamp;
    return false;
  }
  e.preventDefault();
  lastEscape.current = 0;
  field.value = "";
  field.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}
