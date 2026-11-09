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
import { isRemoteProjectPath } from "../../projects/model/recents";
import { pathKey } from "../../../shared/lib/paths";
import { sessionWorkCwd, type Session } from "../../sessions/model/session";
import {
  agentWorktreeCandidates,
  canAdoptAgentWorktree,
  followsAgentWorktrees,
  pickAgentWorktree,
  pickNewAgentWorktree,
} from "../model/agentWorktree";
import { listWorktrees } from "../model/worktrees";

type TurnStart = { from: number; before: Promise<Set<string> | null> };

const localSession = (session: Session) =>
  !isRemoteProjectPath(session.cwd) && !isMonoSession(session.id);

/** Moves a session onto the worktree its agent created from the project checkout. */
export function useAgentWorktreeAdoption(
  sessions: readonly Session[],
  setSessions: Dispatch<SetStateAction<Session[]>>,
) {
  const latest = useRef(sessions);
  latest.current = sessions;
  const scanned = useRef(new Map<string, number>());
  const pending = useRef(new Set<string>());
  const turns = useRef(new Map<string, TurnStart>());

  useEffect(() => {
    for (const session of sessions) {
      if (session.busy) {
        if (
          !turns.current.has(session.id) &&
          followsAgentWorktrees(session) &&
          localSession(session)
        )
          turns.current.set(session.id, {
            from: session.blocks.length,
            before: listWorktrees(sessionWorkCwd(session))
              .then(({ worktrees }) => new Set(worktrees.map((tree) => pathKey(tree.path))))
              .catch(() => null),
          });
        continue;
      }
      const turn = turns.current.get(session.id);
      turns.current.delete(session.id);
      if (
        scanned.current.get(session.id) === session.blocks.length ||
        pending.current.has(session.id)
      )
        continue;
      scanned.current.set(session.id, session.blocks.length);
      if (!canAdoptAgentWorktree(session) || !localSession(session)) continue;
      const workDir = sessionWorkCwd(session);
      const candidates = agentWorktreeCandidates(session.blocks, workDir);
      if (!candidates.length && !turn) continue;

      pending.current.add(session.id);
      void listWorktrees(workDir)
        .then(async ({ worktrees }) => {
          const before = await turn?.before;
          const claimed = new Set(
            latest.current
              .filter((s) => s.id !== session.id)
              .map((s) => pathKey(sessionWorkCwd(s))),
          );
          const tree =
            pickAgentWorktree(candidates, worktrees) ??
            (turn && before
              ? pickNewAgentWorktree(
                  before,
                  worktrees,
                  session.blocks.slice(turn.from),
                  claimed,
                )
              : undefined);
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
