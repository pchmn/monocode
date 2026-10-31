import { useEffect, useState } from "react";
import {
  loadInactiveSessionsCollapsed,
  saveInactiveSessionsCollapsed,
  type InactiveGroup,
} from "../../features/sessions/model/inactiveSessions";

export function useInactiveSessions({
  cwd,
  disabled,
  openSessionIds,
  busyIds,
  approvalIds,
  activeId,
}: {
  cwd: string;
  disabled: boolean;
  openSessionIds: readonly string[];
  busyIds: ReadonlySet<string>;
  approvalIds: ReadonlySet<string>;
  activeId: string | undefined;
}): {
  inactiveGroup: InactiveGroup | undefined;
  setInactiveCollapsed: (collapsed: boolean) => void;
} {
  const [collapsed, setCollapsed] = useState(() =>
    loadInactiveSessionsCollapsed(cwd),
  );
  useEffect(() => {
    setCollapsed(loadInactiveSessionsCollapsed(cwd));
  }, [cwd]);
  return {
    inactiveGroup: disabled
      ? undefined
      : {
          activeIds: new Set([
            ...openSessionIds,
            ...busyIds,
            ...approvalIds,
            ...(activeId ? [activeId] : []),
          ]),
          collapsed,
        },
    setInactiveCollapsed: (next) => {
      setCollapsed(next);
      saveInactiveSessionsCollapsed(cwd, next);
    },
  };
}
