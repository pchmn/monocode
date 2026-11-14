import {
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import { moveHarnessSession } from "../../../integrations/harness/core/sessionMoves";
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
  worktreeToolCount,
} from "../model/agentWorktree";
import { listWorktrees } from "../model/worktrees";

type TurnStart = { from: number; before: Promise<Set<string> | null>; scannedTools: number };

const localSession = (session: Session) =>
  !isRemoteProjectPath(session.cwd) && !isMonoSession(session.id);

/** Moves a session onto the worktree its agent creates from the project checkout, as soon as it exists. */
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
    const adopt = (session: Session, turn: TurnStart | undefined) => {
      const workDir = sessionWorkCwd(session);
      const candidates = agentWorktreeCandidates(session.blocks, workDir);
      if (!candidates.length && !turn) return;

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
          moveHarnessSession(current.id, tree.path, () => {
            const moved = latest.current.find((s) => s.id === session.id);
            return moved && pathKey(sessionWorkCwd(moved)) === pathKey(tree.path)
              ? moved
              : undefined;
          });
          const adopted = { worktreeCwd: tree.path, branch: tree.branch ?? undefined };
          latest.current = latest.current.map((s) =>
            s.id === session.id ? { ...s, ...adopted } : s,
          );
          setSessions((prev) =>
            prev.map((s) => (s.id === session.id ? { ...s, ...adopted } : s)),
          );
        })
        .catch(() => undefined)
        .finally(() => pending.current.delete(session.id));
    };

    for (const session of sessions) {
      if (!localSession(session)) continue;
      if (session.busy) {
        if (!followsAgentWorktrees(session)) continue;
        let turn = turns.current.get(session.id);
        if (!turn) {
          turn = {
            from: session.blocks.length,
            before: listWorktrees(sessionWorkCwd(session))
              .then(({ worktrees }) => new Set(worktrees.map((tree) => pathKey(tree.path))))
              .catch(() => null),
            scannedTools: 0,
          };
          turns.current.set(session.id, turn);
        }
        if (pending.current.has(session.id) || !canAdoptAgentWorktree(session)) continue;
        const tools = worktreeToolCount(session.blocks.slice(turn.from));
        if (tools === turn.scannedTools) continue;
        turn.scannedTools = tools;
        adopt(session, turn);
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
      if (canAdoptAgentWorktree(session)) adopt(session, turn);
    }
  }, [sessions, setSessions]);
}
