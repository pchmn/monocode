import { useSyncExternalStore } from "react";
import { loadInsetLayout, subscribeInsetLayout } from "./appearance";
import { readFlag, writeFlag } from "./storageFlags";

const STACKED_KEY = "monocode.stackedSidePanels";
const STACKED_CHANGE_EVENT = "monocode:stacked-side-panels-change";
const TOOLS_HEIGHT_KEY = "monocode.stackedToolsHeight";
export const TOOLS_HEIGHT_DEFAULT = 320;
export const TOOLS_HEIGHT_MIN = 120;
// Keeps the session list readable above the tools.
const SESSIONS_HEIGHT_MIN = 160;

export function loadStackedPanels(): boolean {
  return readFlag(STACKED_KEY) ?? false;
}

export function saveStackedPanels(value: boolean) {
  writeFlag(STACKED_KEY, value);
  window.dispatchEvent(new Event(STACKED_CHANGE_EVENT));
}

export function subscribeStackedPanels(onStoreChange: () => void) {
  window.addEventListener(STACKED_CHANGE_EVENT, onStoreChange);
  return () => window.removeEventListener(STACKED_CHANGE_EVENT, onStoreChange);
}

/** The setting only exists in the inset layout. */
export function useStackedPanels(): boolean {
  const stacked = useSyncExternalStore(
    subscribeStackedPanels,
    loadStackedPanels,
    () => false,
  );
  const inset = useSyncExternalStore(
    subscribeInsetLayout,
    loadInsetLayout,
    () => false,
  );
  return stacked && inset;
}

/** `space`: height shared by the session list, the tools and the Working panel. */
export function clampToolsHeight(height: number, space: number) {
  const max = Math.max(TOOLS_HEIGHT_MIN, space - SESSIONS_HEIGHT_MIN);
  return Math.round(Math.min(max, Math.max(TOOLS_HEIGHT_MIN, height)));
}

// The Working panel is left out so it gives way instead of resizing the tools.
export function toolsSpace(sidebar: HTMLElement, tools: HTMLElement): number {
  const style = getComputedStyle(sidebar);
  let space =
    sidebar.clientHeight -
    parseFloat(style.paddingTop) -
    parseFloat(style.paddingBottom);
  for (const child of sidebar.children) {
    if (
      child === tools ||
      child.matches(".sidebar-session-scroll, [data-live-agents-preview]")
    )
      continue;
    const position = getComputedStyle(child).position;
    if (position === "absolute" || position === "fixed") continue;
    space -= child.getBoundingClientRect().height;
  }
  return space;
}

export function loadToolsHeight(): number {
  try {
    const value = Number(localStorage.getItem(TOOLS_HEIGHT_KEY));
    return value > 0 ? value : TOOLS_HEIGHT_DEFAULT;
  } catch {
    return TOOLS_HEIGHT_DEFAULT;
  }
}

export function saveToolsHeight(height: number) {
  try {
    localStorage.setItem(TOOLS_HEIGHT_KEY, String(height));
  } catch {
    // private mode / quota
  }
}
