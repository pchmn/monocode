import { useSyncExternalStore } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import Layout03Icon from "@hugeicons/core-free-icons/Layout03Icon";
import {
  loadFileTabMode,
  saveFileTabMode,
  subscribeFileTabMode,
} from "../../settings/model/settings";

// Phosphor "tabs": the free Hugeicons set has no tab-strip glyph.
function TabsIcon() {
  return (
    <svg viewBox="0 0 256 256" fill="currentColor" className="size-3.5">
      <path d="M255.66,165.7h0v0a.24.24,0,0,0,0-.08L233.37,91.4A15.89,15.89,0,0,0,218.05,80H208a8,8,0,0,0,0,16h10.05l19.2,64H206L185.37,91.4A15.89,15.89,0,0,0,170.05,80H160a8,8,0,0,0,0,16h10.05l19.2,64H158L137.37,91.4A15.89,15.89,0,0,0,122.05,80H38A15.89,15.89,0,0,0,22.63,91.4L.37,165.6l0,.05v0s0,.05,0,.08A8.1,8.1,0,0,0,0,168a8,8,0,0,0,8,8H248a8,8,0,0,0,7.66-10.3ZM38,96h84.1l19.2,64H18.75Z" />
    </svg>
  );
}

export function FileTabModeToggle() {
  const mode = useSyncExternalStore(subscribeFileTabMode, loadFileTabMode);
  if (mode === "workspace") return null;
  const stacked = mode === "stacked";
  const label = stacked ? "Show files beside chat" : "Show files as sub-tabs";
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => saveFileTabMode(stacked ? "pane" : "stacked")}
      className="mx-1 grid size-6 shrink-0 cursor-default place-items-center self-center rounded-md text-content/45 hover:bg-content/5 hover:text-content"
    >
      {stacked ? (
        <HugeiconsIcon
          icon={Layout03Icon}
          className="size-3.5"
          strokeWidth={1.75}
        />
      ) : (
        <TabsIcon />
      )}
    </button>
  );
}
