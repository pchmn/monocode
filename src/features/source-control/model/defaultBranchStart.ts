import { invoke } from "@tauri-apps/api/core";
import { isMonoSession } from "../../monos/model/mono";
import { isCodeWorkspace } from "../../projects/model/codeWorkspace";
import { isBlankSession } from "../../projects/model/projectReturn";
import { isRemoteProjectPath } from "../../projects/model/recents";
import type { Session } from "../../sessions/model/session";
import { pathKey } from "../../../shared/lib/paths";

export type DefaultBranchStart = {
  branch: string;
  base: string;
};

export const defaultBranchName = (cwd: string) =>
  invoke<string | null>("default_branch_name", { cwd });

const fetchedAt = new Map<string, number>();
const FRESH_FETCH_MS = 2 * 60_000;

export async function fetchDefaultBranch(cwd: string) {
  await invoke<void>("default_branch_fetch", { cwd });
  fetchedAt.set(pathKey(cwd), Date.now());
}

const fetchedRecently = (cwd: string) =>
  Date.now() - (fetchedAt.get(pathKey(cwd)) ?? 0) < FRESH_FETCH_MS;

export const defaultBranchStart = (cwd: string) =>
  invoke<DefaultBranchStart | null>("default_branch_start", { cwd });

export const branchBehindUpstream = (cwd: string) =>
  invoke<number>("branch_behind_upstream", { cwd });

type StartSession = Pick<
  Session,
  "id" | "cwd" | "worktreeCwd" | "busy" | "blocks" | "automationId"
>;

export function startsFromDefaultBranch(session: StartSession): boolean {
  return (
    !!session.cwd &&
    session.cwd !== "~" &&
    !session.worktreeCwd &&
    !session.automationId &&
    !isCodeWorkspace(session.cwd) &&
    !isRemoteProjectPath(session.cwd) &&
    !isMonoSession(session.id) &&
    isBlankSession(session as Session)
  );
}

/** An unchosen base, or the default branch itself, means its freshest remote state. */
export function worktreeStartBase(
  base: string | undefined,
  start: Pick<DefaultBranchStart, "branch" | "base"> | null,
): string {
  if (start && (!base || base === "HEAD" || base === start.branch))
    return start.base;
  return base || "HEAD";
}

export async function freshWorktreeBase(cwd: string, base?: string) {
  try {
    if (!fetchedRecently(cwd)) await fetchDefaultBranch(cwd);
    return worktreeStartBase(base, await defaultBranchStart(cwd));
  } catch {
    return base || "HEAD";
  }
}
