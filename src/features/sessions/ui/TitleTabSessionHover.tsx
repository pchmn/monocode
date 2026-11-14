import { useEffect, useId, useRef, useState } from "react";
import { CheckCircle, CircleDot } from "../../../shared/ui/icons";
import type { LinkedWorkItem } from "../model/session";
import { useTabSessionSummary } from "../model/tabSessionSummaries";
import {
  LINKED_PR_STATE_TONE,
  LinkedPrStateIcon,
  useLinkedPrState,
} from "./LinkedPrStateIcon";
import { SessionCardPreview } from "./SessionCardPreview";
import { TerminalSpinner } from "./TerminalSpinner";

const OPEN_DELAY_MS = 400;
const CLOSE_DELAY_MS = 120;
// Sweeping along the tabs swaps cards without waiting for the delay again.
const WARM_MS = 300;
let warmUntil = 0;

type TabState = {
  sessionId?: string;
  busyHarnesses: readonly string[];
  backgroundHarnesses?: readonly string[];
  doneHarnesses?: readonly string[];
};

/** Inside a title tab: the linked issue/PR icon, and the session card on hover. */
export function TitleTabSessionHover({ tab }: { tab: TabState }) {
  const session = useTabSessionSummary(tab.sessionId);
  const markerRef = useRef<HTMLSpanElement>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const id = useId();
  const timers = useRef<{ open?: number; close?: number }>({});

  const clear = () => {
    window.clearTimeout(timers.current.open);
    window.clearTimeout(timers.current.close);
  };
  const close = () => {
    clear();
    setOpen((was) => {
      if (was) warmUntil = performance.now() + WARM_MS;
      return false;
    });
  };
  const scheduleClose = () => {
    clear();
    timers.current.close = window.setTimeout(close, CLOSE_DELAY_MS);
  };

  useEffect(() => {
    const tabButton =
      markerRef.current?.closest<HTMLElement>("[data-title-tab]");
    if (!tabButton || !session) return;
    setAnchor(tabButton);
    let nativeTitle: string | null = null;
    const onEnter = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      clear();
      // The card replaces the native tooltip, which would cover it.
      nativeTitle = tabButton.getAttribute("title");
      tabButton.removeAttribute("title");
      if (performance.now() < warmUntil) setOpen(true);
      else
        timers.current.open = window.setTimeout(
          () => setOpen(true),
          OPEN_DELAY_MS,
        );
    };
    tabButton.addEventListener("pointerenter", onEnter);
    const onLeave = () => {
      if (nativeTitle != null) tabButton.setAttribute("title", nativeTitle);
      nativeTitle = null;
      scheduleClose();
    };
    tabButton.addEventListener("pointerleave", onLeave);
    tabButton.addEventListener("pointerdown", close);
    return () => {
      tabButton.removeEventListener("pointerenter", onEnter);
      tabButton.removeEventListener("pointerleave", onLeave);
      tabButton.removeEventListener("pointerdown", close);
      clear();
    };
  }, [!!session]);

  const item = session?.linkedWorkItem;
  return (
    <span ref={markerRef} className="contents">
      {item && session ? (
        <TabWorkItemIcon item={item} cwd={session.cwd} />
      ) : null}
      {open && anchor && session ? (
        <SessionCardPreview
          anchor={anchor}
          id={id}
          session={session}
          side="bottom"
          status={<TabStatus tab={tab} />}
          onClose={close}
          onPointerEnter={clear}
          onPointerLeave={scheduleClose}
        />
      ) : null}
    </span>
  );
}

function TabWorkItemIcon({ item, cwd }: { item: LinkedWorkItem; cwd: string }) {
  const label = `${item.kind === "pr" ? "PR" : "Issue"} #${item.number}`;
  if (item.kind !== "pr")
    return (
      <CircleDot
        className="size-3 shrink-0 text-accent"
        strokeWidth={1.75}
        aria-label={label}
      />
    );
  return <TabPrIcon item={item} cwd={cwd} label={label} />;
}

function TabPrIcon({
  item,
  cwd,
  label,
}: {
  item: LinkedWorkItem;
  cwd: string;
  label: string;
}) {
  const state = useLinkedPrState(item, cwd);
  return (
    <span aria-label={label} className="contents">
      <LinkedPrStateIcon
        state={state}
        className={`size-3 shrink-0 ${(state && LINKED_PR_STATE_TONE[state]) ?? "text-accent"}`}
      />
    </span>
  );
}

function TabStatus({ tab }: { tab: TabState }) {
  if (tab.busyHarnesses.length)
    return (
      <span className="flex shrink-0 items-center gap-1 text-[11px] text-accent">
        <TerminalSpinner className="inline-block w-3 select-none text-center text-[11px] leading-none" />
        Working...
      </span>
    );
  if (tab.backgroundHarnesses?.length)
    return (
      <span className="shrink-0 text-[11px] text-content/45">
        In background
      </span>
    );
  if (tab.doneHarnesses?.length)
    return (
      <span className="flex shrink-0 items-center gap-1 text-[11px] text-emerald-400">
        <CheckCircle className="size-3" strokeWidth={2} />
        Done
      </span>
    );
  return null;
}
