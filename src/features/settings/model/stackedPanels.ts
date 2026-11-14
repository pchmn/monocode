import { useSyncExternalStore } from "react";
import { loadInsetLayout, subscribeInsetLayout } from "./appearance";
import { readFlag, writeFlag } from "./storageFlags";

const STACKED_KEY = "monocode.stackedSidePanels";
const STACKED_CHANGE_EVENT = "monocode:stacked-side-panels-change";

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
