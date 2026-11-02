import { useCallback, useEffect, useState } from "react";
import {
  gitPull,
  notifyGitChanged,
  subscribeGitChanged,
} from "../../../platform/tauri/fs";
import { ArrowDownCircle, Loader } from "../../../shared/ui/icons";
import { isRemoteProjectPath } from "../../projects/model/recents";
import { branchBehindUpstream } from "../model/defaultBranchStart";

type Props = {
  cwd: string;
  branch?: string;
  enabled?: boolean;
};

/** Fast-forwards the checkout's branch from its upstream, shown only when that would bring commits. */
export function BranchSyncButton({ cwd, branch, enabled = true }: Props) {
  const [behind, setBehind] = useState(0);
  const [pulling, setPulling] = useState(false);
  const [error, setError] = useState<string>();
  const active = !!cwd && cwd !== "~" && !isRemoteProjectPath(cwd);

  const refresh = useCallback(() => {
    if (!active) return setBehind(0);
    void branchBehindUpstream(cwd)
      .catch(() => 0)
      .then(setBehind);
  }, [active, cwd]);

  useEffect(() => {
    refresh();
    return subscribeGitChanged(refresh, cwd);
  }, [refresh, cwd, branch]);

  if (!active || behind === 0) return null;

  const pull = async () => {
    setPulling(true);
    setError(undefined);
    try {
      await gitPull(cwd);
    } catch (e) {
      setError(String(e));
    } finally {
      setPulling(false);
      notifyGitChanged({ cwd });
    }
  };

  const commits = `${behind} commit${behind === 1 ? "" : "s"}`;
  return (
    <button
      type="button"
      disabled={!enabled || pulling}
      onClick={pull}
      title={error ?? `Pull ${commits} from upstream`}
      aria-label={`Pull ${commits} from upstream`}
      className={`flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-[12px] hover:bg-content/8 hover:text-content disabled:opacity-40 disabled:hover:bg-transparent active:scale-[0.97] ${error ? "text-red-400/90" : "text-content/55"}`}
    >
      {pulling ? (
        <Loader className="size-3.5 animate-spin" />
      ) : (
        <ArrowDownCircle className="size-3.5" />
      )}
      {behind}
    </button>
  );
}
