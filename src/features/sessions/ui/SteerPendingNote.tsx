import { useContext, useEffect, useState } from "react";
import { interruptClaudeStep } from "../../../integrations/harness/providers/claude/claude";
import { Clock } from "../../../shared/ui/icons";
import { ToolDetailSession } from "./useToolDetail";
import { formatSteerWait, steerWaitIsLong } from "../model/steerWait";

export function SteerPendingNote({ sentAt }: { sentAt?: number }) {
  const sessionId = useContext(ToolDetailSession);
  const waitedMs = useWaitedMs(sentAt);
  const [interrupting, setInterrupting] = useState(false);
  const long = steerWaitIsLong(waitedMs);
  return (
    <div
      role="status"
      // Delayed so a message read within a second never flashes the note.
      style={{ animation: "agent-chat-fade-in 200ms ease-out 1s both" }}
      className="flex max-w-full items-center gap-1.5 px-3 pt-1 font-sans text-xs text-content/50"
    >
      <Clock className="size-3 shrink-0" strokeWidth={1.75} />
      <span>
        {long ? `Waiting ${formatSteerWait(waitedMs)}` : "Waiting"} · read once
        the current step finishes
      </span>
      {long && sessionId ? (
        <button
          type="button"
          disabled={interrupting}
          title="Cut the running step short so Claude reads this message now. Background tasks keep running."
          onClick={() => {
            setInterrupting(true);
            void interruptClaudeStep(sessionId).catch((error) => {
              console.error(error);
              setInterrupting(false);
            });
          }}
          className="cursor-pointer rounded px-1 text-content/70 underline-offset-2 hover:text-content hover:underline disabled:cursor-default disabled:no-underline disabled:opacity-60"
        >
          {interrupting ? "Interrupting…" : "Interrupt and send"}
        </button>
      ) : null}
    </div>
  );
}

function useWaitedMs(sentAt: number | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return sentAt == null ? 0 : Math.max(0, now - sentAt);
}
