import type { BuiltinSkill } from "../../skills/model/skills";
import {
  isWorkspaceFolderPending,
  setWorkspaceFolderPending,
} from "../../projects/model/codeWorkspace";
import { newSessionForProject, type Session } from "./session";

export const CLEAR_COMMAND: BuiltinSkill = {
  kind: "builtin",
  name: "clear",
  invocation: "clear",
  description: "Start a fresh session here, replacing this one.",
  scope: "builtin",
  source: "monocode",
};

export function isClearCommand(text: string): boolean {
  return /^\s*\/clear\s*$/i.test(text);
}

/** The session that replaces `current`: same project, worktree, branch and workspace folder. */
export function clearedSession(current: Session): Session {
  const fresh = {
    ...newSessionForProject(current, current.cwd),
    worktreeCwd: current.worktreeCwd,
    branch: current.branch,
  };
  setWorkspaceFolderPending(fresh.id, isWorkspaceFolderPending(current.id));
  return fresh;
}
