import { useEffect, useState } from "react";
import { notifyGitChanged } from "../../../platform/tauri/fs";
import { pathKey } from "../../../shared/lib/paths";
import { isRemoteProjectPath } from "../../projects/model/recents";
import { fetchDefaultBranch } from "../model/defaultBranchStart";

const FRESH_MS = 60_000;
const fetchedAt = new Map<string, number>();

/** Fetches `origin` when the picker opens, so branches pushed since show up. */
export function useBranchPickerFetch(cwd: string, open: boolean): boolean {
  const [fetching, setFetching] = useState(false);
  useEffect(() => {
    if (!open || !cwd || cwd === "~" || isRemoteProjectPath(cwd)) return;
    const key = pathKey(cwd);
    if (Date.now() - (fetchedAt.get(key) ?? 0) < FRESH_MS) return;
    fetchedAt.set(key, Date.now());
    let live = true;
    setFetching(true);
    void fetchDefaultBranch(cwd)
      .catch(() => undefined)
      .finally(() => {
        notifyGitChanged({ cwd });
        if (live) setFetching(false);
      });
    return () => {
      live = false;
      setFetching(false);
    };
  }, [cwd, open]);
  return fetching;
}
