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
const prCache = new Map<string, { at: number; pr: Pr }>();

function useBranchPr(cwd: string, branch: string | undefined): Pr {
  const key = `${cwd}\0${branch ?? ""}`;
  const [pr, setPr] = useState<Pr>(prCache.get(key)?.pr ?? null);
  useEffect(() => {
    if (!cwd) return;
    let live = true;
    const load = () => {
      const hit = prCache.get(key);
      if (hit && Date.now() - hit.at < PR_TTL_MS) {
        setPr(hit.pr);
        return;
      }
      void gitPrStatus(cwd)
        .catch(() => null)
        .then((next) => {
          prCache.set(key, { at: Date.now(), pr: next });
          if (live) setPr(next);
        });
    };
    load();
    const timer = setInterval(load, PR_TTL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [cwd, key]);
  return pr;
}

export function SessionStatusLine({
  context,
  info,
  cwd,
  branch,
}: {
  context?: ContextUsage;
  info?: SessionStatusInfo;
  cwd: string;
  branch?: string;
}) {
  const costUsd = info?.costUsd;
  const lookedUp = useBranchPr(info?.pr ? "" : cwd, branch);
  const pr = info?.pr ?? lookedUp;
  const parts = [
    context ? formatContextText(context) : null,
    costUsd ? formatCost(costUsd) : null,
  ].filter((part): part is string => part != null);
  if (parts.length === 0 && !pr) return null;
  return (
    <div className="flex min-w-0 items-center gap-1 truncate text-[11px] text-content/45">
      <span className="truncate">{parts.join(" · ")}</span>
      {pr ? (
        <>
          {parts.length ? <span>·</span> : null}
          <button
            type="button"
            title={pr.title}
            onClick={() => void openUrl(pr.url).catch(() => undefined)}
            className="shrink-0 hover:text-content/80 hover:underline"
          >
            PR #{pr.number}
          </button>
        </>
      ) : null}
    </div>
  );
}
