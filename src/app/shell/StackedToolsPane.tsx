import { useState, type PointerEvent } from "react";
import {
  clampToolsHeight,
  loadToolsHeight,
  saveToolsHeight,
  TOOLS_HEIGHT_DEFAULT,
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

  const panelHeight = (el: Element) =>
    el.closest("aside")?.getBoundingClientRect().height ?? Infinity;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const startY = event.clientY;
    const startHeight = height;
    const max = panelHeight(handle);
    let next = startHeight;
    setDragging(true);
    const onMove = (move: globalThis.PointerEvent) => {
      next = clampToolsHeight(startHeight + startY - move.clientY, max);
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
      className={
        shown
          ? "relative flex min-h-0 shrink-0 flex-col border-t border-stroke"
          : "hidden"
      }
      style={{ height: `min(${height}px, calc(100% - 160px))` }}
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize project tools"
        aria-valuenow={height}
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
