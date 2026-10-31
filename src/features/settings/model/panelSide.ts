import { useLayoutEffect, useSyncExternalStore } from "react";
import { loadInsetLayout, subscribeInsetLayout } from "./appearance";
import { readFlag, writeFlag } from "./storageFlags";

const SWAP_PANELS_KEY = "monocode.swapSidePanels";
const SWAP_PANELS_CHANGE_EVENT = "monocode:swap-side-panels-change";
export const SWAP_PANELS_DEFAULT = false;
const SWAPPED_CLASS = "panels-swapped";

export function loadSwapSidePanels(): boolean {
  return readFlag(SWAP_PANELS_KEY) ?? SWAP_PANELS_DEFAULT;
}

export function saveSwapSidePanels(value: boolean) {
  writeFlag(SWAP_PANELS_KEY, value);
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<boolean>(SWAP_PANELS_CHANGE_EVENT));
}

export function subscribeSwapSidePanels(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(SWAP_PANELS_CHANGE_EVENT, onStoreChange);
  return () =>
    window.removeEventListener(SWAP_PANELS_CHANGE_EVENT, onStoreChange);
}

/** The swap only exists in the inset layout. */
export function panelsSwapped(swap: boolean, inset: boolean) {
  return swap && inset;
}

/** Drag direction of a pane whose handle faces the card ("sessions") or the window edge ("tools"). */
export function resizeDirection(
  role: "sessions" | "tools",
  swapped: boolean,
): "left" | "right" {
  return (role === "sessions") !== swapped ? "right" : "left";
}

/** Mirrors the setting onto <html> for swapPanels.css; safe to call from several components. */
export function usePanelsSwapped(): boolean {
  const swap = useSyncExternalStore(
    subscribeSwapSidePanels,
    loadSwapSidePanels,
    () => SWAP_PANELS_DEFAULT,
  );
  const inset = useSyncExternalStore(
    subscribeInsetLayout,
    loadInsetLayout,
    () => false,
  );
  const swapped = panelsSwapped(swap, inset);
  useLayoutEffect(() => {
    document.documentElement.classList.toggle(SWAPPED_CLASS, swapped);
  }, [swapped]);
  return swapped;
}

const TOOLS_WIDTH_VAR = "--inset-tools-width";

/** Publishes the left-docked tools panel width so swapPanels.css can start the title tabs after it. */
export function useToolsPanelWidthVar(swapped: boolean) {
  useLayoutEffect(() => {
    if (!swapped) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(([entry]) =>
      root.style.setProperty(
        TOOLS_WIDTH_VAR,
        `${entry.target.getBoundingClientRect().width}px`,
      ),
    );
    let frame = 0;
    const attach = () => {
      const panel = document.querySelector('[aria-label="Project tools"]')
        ?.parentElement;
      if (panel) observer.observe(panel);
      // The card can mount after the title bar.
      else frame = requestAnimationFrame(attach);
    };
    attach();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      root.style.removeProperty(TOOLS_WIDTH_VAR);
    };
  }, [swapped]);
}
