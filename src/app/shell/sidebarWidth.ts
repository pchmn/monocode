const SIDEBAR_WIDTH_KEY = "monocode.sidebarWidth";

export function loadSidebarWidth(fallback: number): number {
  try {
    const parsed = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    return parsed > 0 ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function saveSidebarWidth(value: number) {
  try {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(Math.round(value)));
  } catch {
    // private mode / quota
  }
}
