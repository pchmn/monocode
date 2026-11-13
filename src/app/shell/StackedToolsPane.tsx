import { useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import {
  clampToolsHeight,
  loadToolsHeight,
  saveToolsHeight,
  TOOLS_HEIGHT_DEFAULT,
  toolsSpace,
} from "../../features/settings/model/stackedPanels";

/** Hosts the project tools under the session list when the side panels are stacked. */
export function StackedToolsPane({
  onHost,
  shown,
}: {
  onHost: (el: HTMLDivElement | null) => void;
  shown: boolean;
}) {
  const [height, setHeight] = useState(loadToolsHeight);
  const [dragging, setDragging] = useState(false);
  const [space, setSpace] = useState(Infinity);
  const paneRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const pane = paneRef.current;
    const sidebar = pane?.parentElement;
    if (!shown || !pane || !sidebar) return;
    const measure = () => setSpace(toolsSpace(sidebar, pane));
    const resize = new ResizeObserver(measure);
    const observeRows = () => {
      resize.disconnect();
      resize.observe(sidebar);
      for (const child of sidebar.children) resize.observe(child);
    };
    observeRows();
    const rows = new MutationObserver(observeRows);
    rows.observe(sidebar, { childList: true });
    return () => {
      resize.disconnect();
      rows.disconnect();
    };
  }, [shown]);
  const fitted = clampToolsHeight(height, space);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const startY = event.clientY;
    const startHeight = fitted;
    let next = startHeight;
    setDragging(true);
    const onMove = (move: globalThis.PointerEvent) => {
      next = clampToolsHeight(startHeight + startY - move.clientY, space);
      setHeight(next);
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      setDragging(false);
      saveToolsHeight(next);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  };

  return (
    <div
      ref={paneRef}
      className={
        shown
          ? // Near-zero shrink: the Working list scrolls away before the tools lose height.
            "relative flex min-h-[120px] shrink-[0.001] flex-col border-t border-content/15 pt-1.5"
          : "hidden"
      }
      style={{ height: fitted }}
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize project tools"
        aria-valuenow={fitted}
        className={`absolute inset-x-0 -top-px z-10 h-1.5 cursor-row-resize touch-none ${
          dragging ? "bg-content/15" : "hover:bg-content/10"
        }`}
        onPointerDown={onPointerDown}
        onDoubleClick={() => {
          setHeight(TOOLS_HEIGHT_DEFAULT);
          saveToolsHeight(TOOLS_HEIGHT_DEFAULT);
        }}
      />
      <div ref={onHost} className="flex min-h-0 flex-1 flex-col" />
    </div>
  );
}
