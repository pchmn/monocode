// The sheet sits outside [data-composer], above any queue or review ledge, so look it up from the dock.
export function approvalSheetLedge(composerBox: Element): Element | null {
  return (
    composerBox
      .closest("[data-session-composer]")
      ?.querySelector("[data-approval-sheet]") ?? null
  );
}
