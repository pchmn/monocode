import {
  isTerminalTab,
  layoutLeaves,
  type EditorPane,
  type LayoutNode,
} from "./layout";
import { loadFileTabMode } from "../../settings/model/settings";

export type StackedPair = { sessionId: string; paneId: string };
export type StackedSurface = "session" | "file";

/** The one session + one file pane a layout is made of, or null for any other shape. */
export function stackedPair(
  layout: LayoutNode,
  sessionIds: readonly string[],
  editorPanes: readonly EditorPane[],
): StackedPair | null {
  const leaves = layoutLeaves(layout);
  if (leaves.length !== 2) return null;
  const pane = editorPanes.find((entry) =>
    leaves.some((leaf) => leaf.id === entry.id),
  );
  const session = leaves.find((leaf) => sessionIds.includes(leaf.id));
  if (!pane || !session || !pane.files.length) return null;
  if (pane.files.some(isTerminalTab)) return null;
  return { sessionId: session.id, paneId: pane.id };
}

/** Focus alone decides the surface, so every model focus change stays in sync. */
export function stackedSurface(
  pair: StackedPair,
  focusedId: string,
): StackedSurface {
  return focusedId === pair.paneId ? "file" : "session";
}

/** In sub-tabs mode the top tab names the session, whichever sub-tab is shown. */
export function titlesAsSession(
  layout: LayoutNode,
  sessionIds: readonly string[],
  editorPanes: readonly EditorPane[],
): boolean {
  return (
    loadFileTabMode() === "stacked" &&
    stackedPair(layout, sessionIds, editorPanes) !== null
  );
}
