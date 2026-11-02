import { useState } from "react";
import {
  gitCheckout,
  gitCommit,
  gitPull,
  gitStageAll,
  gitStash,
  isCheckoutBlockedByChanges,
  notifyGitChanged,
} from "../../../platform/tauri/fs";
import { ArrowLeftRight, Loader } from "../../../shared/ui/icons";
import { branchBehindUpstream } from "../model/defaultBranchStart";
import { useBranchWorktree } from "../hooks/useBranchWorktree";
import { SwitchBranchDialog } from "./SwitchBranchDialog";

type Props = {
  cwd: string;
  branch?: string;
  defaultBranch?: string | null;
  enabled?: boolean;
  onChange?: () => void;
};

const message = (err: unknown) =>
  err instanceof Error ? err.message : String(err);

async function checkoutLatest(cwd: string, branch: string) {
  await gitCheckout(cwd, branch);
  // A failed pull leaves the checkout switched; BranchSyncButton then offers the retry.
  if ((await branchBehindUpstream(cwd).catch(() => 0)) > 0)
    await gitPull(cwd).catch(() => undefined);
}

/** Offers the up-to-date default branch to a session that has not started yet. */
export function DefaultBranchSwitch({
  cwd,
  branch,
  defaultBranch,
  enabled = true,
  onChange,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [blocked, setBlocked] = useState(false);
  const [blockedBusy, setBlockedBusy] = useState<"stash" | "commit" | null>(
    null,
  );
  const [blockedError, setBlockedError] = useState<string | null>(null);

  const branchWorktree = useBranchWorktree(cwd, !!cwd);

  if (!cwd || !branch || !defaultBranch || branch === defaultBranch)
    return null;
  // Git refuses it there; the branch picker offers that worktree instead.
  if (branchWorktree(defaultBranch)) return null;

  const done = () => {
    setBlocked(false);
    setBlockedBusy(null);
    notifyGitChanged({ cwd });
    onChange?.();
  };

  const switchToDefault = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await checkoutLatest(cwd, defaultBranch);
      done();
    } catch (err) {
      if (isCheckoutBlockedByChanges(message(err))) {
        setBlockedError(null);
        setBlocked(true);
      } else setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  const resolveBlocked = async (
    kind: "stash" | "commit",
    work: () => Promise<unknown>,
  ) => {
    if (blockedBusy) return;
    setBlockedBusy(kind);
    setBlockedError(null);
    try {
      await work();
      await checkoutLatest(cwd, defaultBranch);
      done();
    } catch (err) {
      setBlockedError(message(err));
      setBlockedBusy(null);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={!enabled || busy}
        onClick={switchToDefault}
        title={error ?? `Check out ${defaultBranch} and pull it from upstream`}
        className={`-ml-1.5 flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-[12px] bg-accent/10 hover:bg-accent/20 disabled:opacity-40 disabled:hover:bg-accent/10 active:scale-[0.97] ${error ? "text-red-400/90" : "text-accent"}`}
      >
        {busy ? (
          <Loader className="size-3.5 animate-spin" />
        ) : (
          <ArrowLeftRight className="size-3.5" />
        )}
        Switch to {defaultBranch}
      </button>
      {blocked ? (
        <SwitchBranchDialog
          cwd={cwd}
          branch={defaultBranch}
          busy={blockedBusy}
          error={blockedError}
          onStash={() => {
            void resolveBlocked("stash", () =>
              gitStash(cwd, `WIP before switching to ${defaultBranch}`),
            );
          }}
          onCommit={(text) => {
            void resolveBlocked("commit", async () => {
              await gitStageAll(cwd);
              await gitCommit(cwd, text);
            });
          }}
          onCancel={() => {
            if (!blockedBusy) setBlocked(false);
          }}
        />
      ) : null}
    </>
  );
}
