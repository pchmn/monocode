import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { gitPrStatus } from "../../../platform/tauri/fs";
import type { ContextUsage } from "../model/contextUsage";
import { formatContextText, formatCost } from "../model/sessionStatusLine";

type Pr = Awaited<ReturnType<typeof gitPrStatus>>;

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
  costUsd,
  cwd,
  branch,
}: {
  context?: ContextUsage;
  costUsd?: number;
  cwd: string;
  branch?: string;
}) {
  const pr = useBranchPr(cwd, branch);
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
