import { useEffect, useState } from "react";
import { defaultBranchName } from "../model/defaultBranchStart";

/** `undefined` while loading, `null` when the project has no default branch. */
export function useDefaultBranch(cwd: string, enabled: boolean) {
  const [state, setState] = useState<{ cwd: string; branch: string | null }>();
  const active = enabled && !!cwd && cwd !== "~";

  useEffect(() => {
    if (!active) return;
    let live = true;
    defaultBranchName(cwd)
      .catch(() => null)
      .then((branch) => {
        if (live) setState({ cwd, branch });
      });
    return () => {
      live = false;
    };
  }, [active, cwd]);

  return active && state?.cwd === cwd ? state.branch : undefined;
}
