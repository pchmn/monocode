import { Clock } from "../../../shared/ui/icons";

export function SteerPendingNote() {
  return (
    <div
      role="status"
      // Delayed so a message read within a second never flashes the note.
      style={{ animation: "agent-chat-fade-in 200ms ease-out 1s both" }}
      className="flex max-w-full items-center gap-1.5 px-3 pt-1 font-sans text-xs text-content/50"
    >
      <Clock className="size-3 shrink-0" strokeWidth={1.75} />
      <span>Waiting · read once the current step finishes</span>
    </div>
  );
}
