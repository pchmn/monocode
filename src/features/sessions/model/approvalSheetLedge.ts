// The sheets sit outside [data-composer], above any queue or review ledge, so look them up from the dock.
export function approvalSheetLedge(composerBox: Element): Element | null {
  const dock = composerBox.closest("[data-session-composer]");
  return (
    dock?.querySelector("[data-detail-sheet]") ??
    dock?.querySelector("[data-approval-sheet]") ??
    null
  );
}
