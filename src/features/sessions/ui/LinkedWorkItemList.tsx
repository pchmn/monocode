import { openUrl } from "@tauri-apps/plugin-opener";
import { useState } from "react";
import { ChevronDown, ExternalLink } from "../../../shared/ui/icons";
import { useSessionWorkItems } from "../hooks/useSessionPrs";
import type { LinkedWorkItem } from "../model/session";
import {
  LinkedWorkItemBlock,
  LinkedWorkItemDetails,
  LinkedWorkItemStateIcon,
  useLinkedWorkItemView,
} from "./LinkedWorkItemBlock";

/** The session card's linked items: today's block for one, folded rows for several. */
export function LinkedWorkItemList({
  sessionId,
  linked,
  cwd,
}: {
  sessionId: string;
  linked?: LinkedWorkItem;
  cwd: string;
}) {
  const items = useSessionWorkItems(sessionId, linked);
  if (items.length === 0) return null;
  if (items.length === 1) return <LinkedWorkItemBlock item={items[0]!} cwd={cwd} />;
  return (
    <div className="mt-3 flex min-w-[276px] flex-col gap-1">
      {items.map((item) => (
        <LinkedWorkItemFold key={item.url} item={item} cwd={cwd} />
      ))}
    </div>
  );
}

function LinkedWorkItemFold({ item, cwd }: { item: LinkedWorkItem; cwd: string }) {
  const [open, setOpen] = useState(false);
  const view = useLinkedWorkItemView(item, cwd);
  const label = `${item.repo} #${item.number}`;
  return (
    <div
      className={`rounded-lg border transition-colors duration-100 ease-out ${open ? "border-stroke bg-content/[0.04]" : "border-transparent bg-content/[0.03] hover:bg-content/[0.06]"}`}
    >
      <div className="flex items-center text-[11px]">
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${open ? "Fold" : "Unfold"} ${label}`}
          onClick={(event) => {
            event.stopPropagation();
            setOpen((value) => !value);
          }}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 py-1.5 pl-2.5 text-left [container-type:inline-size]"
        >
          <LinkedWorkItemStateIcon view={view} withCi={!open} />
          <span className="shrink-0 text-content/55">
            {open ? item.repo : (item.repo.split("/")[1] ?? item.repo)}
          </span>
          {open ? null : (
            <span className="min-w-0 flex-1 truncate text-content/80">
              {view.workItem?.title}
            </span>
          )}
          <span className="ml-auto shrink-0 pl-1 tabular-nums text-content/70">
            #{item.number}
          </span>
          <ChevronDown
            className={`size-3 shrink-0 text-content/40 transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? "" : "-rotate-90"}`}
          />
        </button>
        <button
          type="button"
          title={`Open ${label} on GitHub`}
          aria-label={`Open ${label} on GitHub`}
          onClick={(event) => {
            event.stopPropagation();
            void openUrl(item.url).catch(() => undefined);
          }}
          className="mx-1 grid size-5 shrink-0 cursor-pointer place-items-center rounded text-content/45 transition-colors duration-100 ease-out hover:bg-content/[0.08] hover:text-content/85 active:scale-[0.94]"
        >
          <ExternalLink className="size-3" />
        </button>
      </div>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden" inert={!open}>
          <div className="flex flex-col px-2.5 pb-2">
            <LinkedWorkItemDetails view={view} />
          </div>
        </div>
      </div>
    </div>
  );
}
