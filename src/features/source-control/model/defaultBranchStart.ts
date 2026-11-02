import { invoke } from "@tauri-apps/api/core";
import { isMonoSession } from "../../monos/model/mono";
import { isCodeWorkspace } from "../../projects/model/codeWorkspace";
import { isBlankSession } from "../../projects/model/projectReturn";
import { isRemoteProjectPath } from "../../projects/model/recents";
import { sessionWorkCwd, type Session } from "../../sessions/model/session";
import { pathKey } from "../../../shared/lib/paths";

export type DefaultBranchStart = {
  branch: string;
  base: string;
  onDefault: boolean;
};

export const defaultBranchName = (cwd: string) =>
  invoke<string | null>("default_branch_name", { cwd });

export const fetchDefaultBranch = (cwd: string) =>
  invoke<void>("default_branch_fetch", { cwd });

export const startFromDefaultBranch = (cwd: string, checkout: boolean) =>
  invoke<DefaultBranchStart | null>("default_branch_start", { cwd, checkout });

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

export function checkoutInUse(
  sessions: readonly Pick<Session, "id" | "cwd" | "worktreeCwd" | "busy">[],
  session: Pick<Session, "id" | "cwd" | "worktreeCwd">,
): boolean {
  const checkout = pathKey(sessionWorkCwd(session));
  return sessions.some(
    (other) =>
      other.id !== session.id &&
      !!other.busy &&
      pathKey(sessionWorkCwd(other)) === checkout,
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
    await fetchDefaultBranch(cwd);
    return worktreeStartBase(base, await startFromDefaultBranch(cwd, false));
  } catch {
    return base || "HEAD";
  }
}
