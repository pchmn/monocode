import {
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  bindHarnessSession,
  forgetHarnessSession,
} from "../../../integrations/harness/core/registry";
import { isMonoSession } from "../../monos/model/mono";
import {
  isCodeWorkspace,
  projectWorkDir,
} from "../../projects/model/codeWorkspace";
import { isRemoteProjectPath } from "../../projects/model/recents";
import { sessionWorkCwd, type Session } from "../../sessions/model/session";
import {
  agentWorktreeCandidates,
  canAdoptAgentWorktree,
  pickAgentWorktree,
} from "../model/agentWorktree";
import { listWorktrees } from "../model/worktrees";

/** Moves a session onto the worktree its agent created from the project checkout. */
export function useAgentWorktreeAdoption(
  sessions: readonly Session[],
  setSessions: Dispatch<SetStateAction<Session[]>>,
) {
  const latest = useRef(sessions);
  latest.current = sessions;
  const scanned = useRef(new Map<string, number>());
  const pending = useRef(new Set<string>());

  useEffect(() => {
    for (const session of sessions) {
      if (
        session.busy ||
        scanned.current.get(session.id) === session.blocks.length ||
        pending.current.has(session.id)
      )
        continue;
      scanned.current.set(session.id, session.blocks.length);
      if (
        !canAdoptAgentWorktree(session) ||
        isCodeWorkspace(session.cwd) ||
        isRemoteProjectPath(session.cwd) ||
        isMonoSession(session.id)
      )
        continue;
      const candidates = agentWorktreeCandidates(
        session.blocks,
        sessionWorkCwd(session),
      );
      if (!candidates.length) continue;

      pending.current.add(session.id);
      void listWorktrees(projectWorkDir(session.cwd))
        .then(async ({ worktrees }) => {
          const tree = pickAgentWorktree(candidates, worktrees);
          const current = latest.current.find((s) => s.id === session.id);
          if (!tree || !current || !canAdoptAgentWorktree(current)) return;
          // The idle provider process keeps the old cwd and would drop the resume.
          await forgetHarnessSession(current.harness, current.id);
          const after = latest.current.find((s) => s.id === session.id);
          if (!after?.providerSessionId) return;
          const adopt = canAdoptAgentWorktree(after);
          bindHarnessSession(
            after.harness,
            after.id,
            after.providerSessionId,
            adopt ? tree.path : sessionWorkCwd(after),
            after.providerAccountId,
            after.blocks,
          );
          if (!adopt) return;
          const adopted = {
            ...after,
            worktreeCwd: tree.path,
            branch: tree.branch ?? undefined,
          };
          latest.current = latest.current.map((s) =>
            s.id === adopted.id ? adopted : s,
          );
          setSessions((prev) =>
            prev.map((s) =>
              s.id === adopted.id
                ? { ...s, worktreeCwd: tree.path, branch: tree.branch ?? undefined }
                : s,
            ),
          );
        })
        .catch(() => undefined)
        .finally(() => pending.current.delete(session.id));
    }
  }, [sessions, setSessions]);
}
