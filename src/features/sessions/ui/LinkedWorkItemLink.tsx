import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useId, useRef, useState } from "react";
import { LAYER } from "../../../shared/lib/layers";
import { Popover } from "../../../shared/ui/Popover";
import {
  githubWorkItem,
  githubWorkItemDetails,
  peekGithubWorkItem,
  peekGithubWorkItemDetails,
  type GithubWorkItem,
  type GithubWorkItemDetails,
} from "../../inbox/model/githubTasks";
import type { LinkedWorkItem } from "../model/session";
import { GithubWorkItemCard } from "./UserLinkPreview";

const OPEN_DELAY_MS = 220;
const CLOSE_DELAY_MS = 100;

type LoadState = "idle" | "loading" | "ready" | "unavailable";

export function LinkedWorkItemLink({
  item,
  cwd,
}: {
  item: LinkedWorkItem;
  cwd: string;
}) {
  const anchor = useRef<HTMLAnchorElement>(null);
  const timer = useRef<number | null>(null);
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const { workItem, details, loadState } = useWorkItemPreview(item, cwd, open);

  useEffect(() => () => clearTimer(timer), []);

  const scheduleOpen = (next: boolean, delay: number) => {
    clearTimer(timer);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setOpen(next);
    }, delay);
  };
  const hideNow = () => {
    clearTimer(timer);
    setOpen(false);
  };

  return (
    <>
      <a
        ref={anchor}
        href={item.url}
        aria-describedby={open ? tooltipId : undefined}
        className="hover:text-content hover:underline"
        onMouseEnter={() =>
          open ? clearTimer(timer) : scheduleOpen(true, OPEN_DELAY_MS)
        }
        onMouseLeave={() => scheduleOpen(false, CLOSE_DELAY_MS)}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          hideNow();
          void openUrl(item.url).catch(() => undefined);
        }}
      >
        {item.repo} #{item.number}
      </a>
      {open ? (
        <Popover
          anchor={anchor}
          side="bottom"
          align="start"
          gap={6}
          width={360}
          constrainHeight={false}
          layer={LAYER.submenu}
          onDismiss={hideNow}
          id={tooltipId}
          role="tooltip"
          className="p-3.5 font-sans text-content"
          onMouseEnter={() => clearTimer(timer)}
          onMouseLeave={() => scheduleOpen(false, CLOSE_DELAY_MS)}
        >
          <GithubWorkItemCard
            parsed={item}
            item={workItem}
            details={details}
            loadState={loadState}
          />
        </Popover>
      ) : null}
    </>
  );
}

function useWorkItemPreview(
  item: LinkedWorkItem,
  cwd: string,
  enabled: boolean,
) {
  const { repo, kind, number } = item;
  const [workItem, setWorkItem] = useState<GithubWorkItem | null>(() =>
    peekGithubWorkItem(repo, kind, number),
  );
  const [details, setDetails] = useState<GithubWorkItemDetails | null>(() =>
    peekGithubWorkItemDetails(repo, kind, number),
  );
  const [loadState, setLoadState] = useState<LoadState>(
    workItem || details ? "ready" : "idle",
  );

  useEffect(() => {
    if (!enabled) return;
    const cachedItem = peekGithubWorkItem(repo, kind, number);
    const cachedDetails = peekGithubWorkItemDetails(repo, kind, number);
    setWorkItem(cachedItem);
    setDetails(cachedDetails);
    if (cachedItem && cachedDetails) {
      setLoadState("ready");
      return;
    }
    setLoadState("loading");
    let cancelled = false;
    void Promise.allSettled([
      cachedItem ?? githubWorkItem(cwd, repo, kind, number),
      cachedDetails ?? githubWorkItemDetails(cwd, repo, kind, number),
    ]).then(([itemResult, detailsResult]) => {
      if (cancelled) return;
      if (itemResult.status === "fulfilled") setWorkItem(itemResult.value);
      if (detailsResult.status === "fulfilled") setDetails(detailsResult.value);
      setLoadState(
        itemResult.status === "fulfilled" ||
          detailsResult.status === "fulfilled"
          ? "ready"
          : "unavailable",
      );
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, cwd, repo, kind, number]);

  return { workItem, details, loadState };
}

function clearTimer(timer: { current: number | null }) {
  if (timer.current == null) return;
  window.clearTimeout(timer.current);
  timer.current = null;
}
