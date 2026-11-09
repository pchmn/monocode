import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { gitPrStatus } from "../../../platform/tauri/fs";
import type { ContextUsage } from "../model/contextUsage";
import { formatContextText, formatCost } from "../model/sessionStatusLine";

type Pr = { number: number; url: string; title?: string } | null;

export type SessionStatusInfo = {
  costUsd?: number;
  /** PR already linked to the session; skips the `gh` lookup. */
  pr?: NonNullable<Pr>;
};

const PR_TTL_MS = 5 * 60_000;
// Short so a PR opened during the session shows up within seconds.
const NO_PR_TTL_MS = 20_000;
const prCache = new Map<string, { at: number; pr: Pr }>();

const prTtl = (pr: Pr) => (pr ? PR_TTL_MS : NO_PR_TTL_MS);

function useBranchPr(cwd: string, branch: string | undefined): Pr {
  const key = `${cwd}\0${branch ?? ""}`;
  const [pr, setPr] = useState<Pr>(prCache.get(key)?.pr ?? null);
  useEffect(() => {
    if (!cwd) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (entry: { at: number; pr: Pr }) => {
      if (!live) return;
      setPr(entry.pr);
      const due = entry.at + prTtl(entry.pr) - Date.now();
      timer = setTimeout(load, Math.max(due, 1_000));
    };
    const load = () => {
      const hit = prCache.get(key);
      if (hit && Date.now() - hit.at < prTtl(hit.pr)) return schedule(hit);
      void gitPrStatus(cwd)
        .catch(() => null)
        .then((next) => {
          const entry = { at: Date.now(), pr: next };
          prCache.set(key, entry);
          schedule(entry);
        });
    };
    load();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [cwd, key]);
  return pr;
}

/** Sits before the context ring; the cost follows it in `SessionStatusLine`. */
export function SessionContextText({ context }: { context?: ContextUsage }) {
  if (!context) return null;
  return (
    <span className="truncate text-[11px] text-content/45">
      {formatContextText(context)}
    </span>
  );
}

export function SessionStatusLine({ info }: { info?: SessionStatusInfo }) {
  if (!info?.costUsd) return null;
  return (
    <span className="truncate text-[11px] text-content/45">
      {formatCost(info.costUsd)}
    </span>
  );
}

/** Sits right after the branch picker. */
export function SessionPrLink({
  info,
  cwd,
  branch,
}: {
  info?: SessionStatusInfo;
  cwd: string;
  branch?: string;
}) {
  const lookedUp = useBranchPr(info?.pr ? "" : cwd, branch);
  const pr = info?.pr ?? lookedUp;
  if (!pr) return null;
  return (
    <button
      type="button"
      title={pr.title}
      onClick={() => void openUrl(pr.url).catch(() => undefined)}
      className="shrink-0 cursor-pointer text-[11px] text-content/45 hover:text-content/80 hover:underline"
    >
      PR #{pr.number}
    </button>
  );
}
