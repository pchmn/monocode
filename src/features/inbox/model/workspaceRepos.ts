import { useSyncExternalStore } from "react";
import { pathKey } from "../../../shared/lib/paths";
import type { InboxItem } from "./githubTasks";

const HIDDEN_KEY = "monocode.inboxHiddenRepos";
const listeners = new Set<() => void>();
const reposByWorkspace = new Map<string, readonly string[]>();
let hidden: readonly string[] = loadHidden();
let reposVersion = 0;

function loadHidden(): string[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(HIDDEN_KEY) ?? "[]",
    );
    return Array.isArray(parsed)
      ? parsed.filter((repo): repo is string => typeof repo === "string")
      : [];
  } catch {
    return [];
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function recordWorkspaceRepos(workspace: string, repos: string[]) {
  reposByWorkspace.set(pathKey(workspace), repos);
  reposVersion += 1;
  emit();
}

/** Repositories of the listed workspaces that span more than one, sorted. */
export function workspaceRepoOptions(
  projectPaths: readonly string[],
): string[] {
  const repos = new Set<string>();
  for (const path of projectPaths) {
    const own = reposByWorkspace.get(pathKey(path)) ?? [];
    if (own.length > 1) own.forEach((repo) => repos.add(repo));
  }
  return [...repos].sort((a, b) => a.localeCompare(b));
}

export function useWorkspaceRepoFilter(projectPaths: readonly string[]) {
  useSyncExternalStore(subscribe, () => reposVersion);
  const hiddenRepos = useHiddenInboxRepos();
  return {
    repos: workspaceRepoOptions(projectPaths),
    hidden: new Set(hiddenRepos),
    toggle: (repo: string) => {
      hidden = hiddenRepos.includes(repo)
        ? hiddenRepos.filter((entry) => entry !== repo)
        : [...hiddenRepos, repo];
      try {
        localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden));
      } catch {
        // private mode / quota
      }
      emit();
    },
  };
}

export function useHiddenInboxRepos(): readonly string[] {
  return useSyncExternalStore(subscribe, () => hidden);
}

export function filterInboxByRepo<T extends Pick<InboxItem, "repo">>(
  items: readonly T[],
  hiddenRepos: readonly string[],
): T[] {
  if (hiddenRepos.length === 0) return [...items];
  return items.filter((item) => !item.repo || !hiddenRepos.includes(item.repo));
}
