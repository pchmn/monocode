import type { SessionSummary } from "../data/sessionStore";
import {
  INACTIVE_COLLAPSED_KEY,
  buildSessionList,
  loadGroupCollapsed,
  saveGroupCollapsed,
  type SessionListEntry,
} from "./sessionFolders";

export type InactiveGroup = {
  activeIds: ReadonlySet<string>;
  collapsed: boolean;
};

export function buildSessionListWithInactive(
  visible: SessionSummary[],
  folders: Parameters<typeof buildSessionList>[1],
  ungrouped: SessionSummary[],
  pinnedCollapsed: boolean,
  reminderGroup: Parameters<typeof buildSessionList>[4],
  inactiveGroup?: InactiveGroup,
): SessionListEntry[] {
  const entries = buildSessionList(
    visible,
    folders,
    ungrouped,
    pinnedCollapsed,
    reminderGroup,
  );
  if (!inactiveGroup) return entries;
  const inactive: SessionSummary[] = [];
  const kept = entries.filter((entry) => {
    if (
      entry.kind !== "session" ||
      inactiveGroup.activeIds.has(entry.session.id)
    ) {
      return true;
    }
    inactive.push(entry.session);
    return false;
  });
  if (inactive.length > 0) {
    kept.push({
      kind: "inactive",
      collapsed: inactiveGroup.collapsed,
      sessions: inactive,
    });
  }
  return kept;
}

export function loadInactiveSessionsCollapsed(cwd: string): boolean {
  // Collapsed unless the user explicitly expanded it.
  return !loadGroupCollapsed(cwd, INACTIVE_COLLAPSED_KEY);
}

export function saveInactiveSessionsCollapsed(
  cwd: string,
  collapsed: boolean,
): void {
  // Stored inverted (true = expanded) so the default stays collapsed.
  saveGroupCollapsed(cwd, !collapsed, INACTIVE_COLLAPSED_KEY);
}
