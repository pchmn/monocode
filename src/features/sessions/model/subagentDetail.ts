import type { AgentStep, Block } from "./session";
import { isFailedStatus } from "./transcriptActivity";

const OPEN_EVENT = "monocode:subagent-details";
const HEIGHT_KEY = "monocode.subagentDetailSheet.height";
export const MIN_SHEET_HEIGHT = 160;
/** Transcript left visible above a fully raised sheet. */
const PANE_HEADROOM = 48;

type OpenDetail = { block: Block };

/** Asks the sheet of the pane `from` sits in to show `block`'s run. */
export function openSubagentDetails(from: Element, block: Block): void {
  from.dispatchEvent(
    new CustomEvent<OpenDetail>(OPEN_EVENT, {
      bubbles: true,
      detail: { block },
    }),
  );
}

export function onSubagentDetailsOpen(
  pane: Element,
  listener: (block: Block) => void,
): () => void {
  const handle = (event: Event) =>
    listener((event as CustomEvent<OpenDetail>).detail.block);
  pane.addEventListener(OPEN_EVENT, handle);
  return () => pane.removeEventListener(OPEN_EVENT, handle);
}

export function clampSheetHeight(height: number, room: number): number {
  const max = Math.max(MIN_SHEET_HEIGHT, room - PANE_HEADROOM);
  return Math.round(Math.min(max, Math.max(MIN_SHEET_HEIGHT, height)));
}

export function savedSheetHeight(room: number): number {
  const saved = Number(localStorage.getItem(HEIGHT_KEY));
  return clampSheetHeight(
    Number.isFinite(saved) && saved > 0 ? saved : room * 0.45,
    room,
  );
}

export function saveSheetHeight(height: number): void {
  localStorage.setItem(HEIGHT_KEY, String(Math.round(height)));
}

export function subagentStepCounts(steps: AgentStep[]): {
  tools: number;
  failed: number;
} {
  const tools = steps.filter((step) => step.kind === "tool");
  return {
    tools: tools.length,
    failed: tools.filter((step) => isFailedStatus(step.status)).length,
  };
}
