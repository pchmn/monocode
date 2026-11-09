import type { Block } from "../model/session";
import {
  DETAILS_TRIGGER_ATTR,
  openSubagentDetails,
} from "../model/subagentDetail";

/** Opens `block` in the sheet above the composer; sits inside its row's toggle button. */
export function DetailsPill({
  block,
  label,
  ariaLabel,
}: {
  block: Block;
  label: string;
  ariaLabel: string;
}) {
  const open = (target: Element) => openSubagentDetails(target, block);
  return (
    // A span, not a button: it lives inside the row's own toggle button.
    <span
      role="button"
      tabIndex={0}
      {...{ [DETAILS_TRIGGER_ATTR]: "" }}
      aria-label={ariaLabel}
      onClick={(event) => {
        event.stopPropagation();
        open(event.currentTarget);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        open(event.currentTarget);
      }}
      className="flex h-5 shrink-0 cursor-pointer items-center self-center rounded-full border border-content/15 px-2 font-sans text-[11px] text-content/55 opacity-0 transition-[opacity,color,border-color] duration-200 group-hover:opacity-100 hover:border-content/35 hover:text-content focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent"
    >
      {label}
    </span>
  );
}
