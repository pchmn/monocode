import {
  githubWorkItem,
  type GithubWorkItem,
} from "../../inbox/model/githubTasks";
import {
  fetchGithubPrChecks,
  type GithubPrCheck,
} from "../../inbox/model/githubPrChecks";
import type { LinkedWorkItem } from "./session";

export type LinkedPrState = "open" | "draft" | "merged" | "closed";
export type LinkedPrCi = "pending" | "fail" | "pass";

const STORAGE_KEY = "monocode.mergedLinkedPrs";
const MAX_REMEMBERED = 500;
export const LINKED_PR_REFRESH_MS = 3 * 60_000;
export const LINKED_PR_ON_DEMAND_MS = 15_000;
export const LINKED_PR_CI_PENDING_MS = 45_000;

const states = new Map<string, LinkedPrState>();
const ciStates = new Map<string, LinkedPrCi>();
const fetchedAt = new Map<string, number>();
const inflight = new Set<string>();
const listeners = new Set<() => void>();
let mergedLoaded = false;

export function linkedPrKey(item: Pick<LinkedWorkItem, "repo" | "number">) {
  return `${item.repo.trim().toLowerCase()}#${item.number}`;
}

export function prStateOf(item: Pick<GithubWorkItem, "state" | "draft">) {
  const state = item.state.trim().toLowerCase();
  if (state === "merged") return "merged";
  if (state === "closed") return "closed";
  return item.draft ? "draft" : "open";
}

/** GitHub's rollup: one failure fails the PR even while other checks run. */
export function ciOf(checks: readonly Pick<GithubPrCheck, "state">[]) {
  const has = (state: GithubPrCheck["state"]) =>
    checks.some((check) => check.state === state);
  if (has("fail")) return "fail";
  if (has("pending")) return "pending";
  return has("pass") ? "pass" : null;
}

function loadMerged() {
  if (mergedLoaded) return;
  mergedLoaded = true;
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]",
    );
    if (!Array.isArray(value)) return;
    for (const key of value) {
      if (typeof key === "string") states.set(key, "merged");
    }
  } catch {
    // Unreadable storage: merged PRs are fetched again.
  }
}

function rememberMerged() {
  const keys = [...states].filter(([, s]) => s === "merged").map(([k]) => k);
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(keys.slice(-MAX_REMEMBERED)),
    );
  } catch {
    // Storage unavailable: this PR is fetched again next launch.
  }
}

export function peekLinkedPrState(
  item: Pick<LinkedWorkItem, "repo" | "number">,
): LinkedPrState | null {
  loadMerged();
  return states.get(linkedPrKey(item)) ?? null;
}

export function peekLinkedPrCi(
  item: Pick<LinkedWorkItem, "repo" | "number">,
): LinkedPrCi | null {
  return ciStates.get(linkedPrKey(item)) ?? null;
}

function setLinkedPrCi(
  item: Pick<LinkedWorkItem, "repo" | "number">,
  ci: LinkedPrCi | null,
) {
  const key = linkedPrKey(item);
  if ((ciStates.get(key) ?? null) === ci) return;
  if (ci) ciStates.set(key, ci);
  else ciStates.delete(key);
  for (const listener of listeners) listener();
}

export function subscribeLinkedPrStates(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setLinkedPrState(
  item: Pick<LinkedWorkItem, "repo" | "number">,
  state: LinkedPrState,
) {
  loadMerged();
  const key = linkedPrKey(item);
  fetchedAt.set(key, Date.now());
  if (states.get(key) === state) return;
  states.set(key, state);
  if (state === "merged") rememberMerged();
  for (const listener of listeners) listener();
}

/** Fetches the PR unless it is merged (final) or was fetched recently. */
export function refreshLinkedPrState(
  item: LinkedWorkItem,
  cwd: string,
  maxAgeMs = LINKED_PR_REFRESH_MS,
) {
  if (item.kind !== "pr") return;
  const key = linkedPrKey(item);
  if (peekLinkedPrState(item) === "merged" || inflight.has(key)) return;
  const last = fetchedAt.get(key);
  if (last != null && Date.now() - last < maxAgeMs) return;
  inflight.add(key);
  void githubWorkItem(cwd, item.repo, "pr", item.number, { force: true })
    .then(async (pr) => {
      const state = prStateOf(pr);
      const ci =
        state === "open" || state === "draft"
          ? await fetchGithubPrChecks(cwd, item.repo, item.number)
              .then((result) => ciOf(result.checks))
              .catch(() => peekLinkedPrCi(item))
          : null;
      setLinkedPrCi(item, ci);
      setLinkedPrState(item, state);
    })
    .catch(() => fetchedAt.set(key, Date.now()))
    .finally(() => inflight.delete(key));
}

export function resetLinkedPrStatesForTest() {
  states.clear();
  ciStates.clear();
  fetchedAt.clear();
  inflight.clear();
  listeners.clear();
  mergedLoaded = false;
}
