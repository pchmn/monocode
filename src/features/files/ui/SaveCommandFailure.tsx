import { useRef, useState } from "react";
import { Popover } from "../../../shared/ui/Popover";

/** Footer status when the file was written but its `onSave` command failed. */
export function SaveCommandFailure({ message }: { message: string }) {
  const root = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        ref={root}
        type="button"
        data-save-command-failure
        className="shrink-0 cursor-pointer text-red-400 hover:underline"
        onClick={() => setOpen((current) => !current)}
      >
        Saved · on-save command failed
      </button>
      {open ? (
        <Popover
          anchor={root}
          side="top"
          align="end"
          width={560}
          maxHeight={360}
          onDismiss={() => setOpen(false)}
          ignore="[data-save-command-failure]"
          className="overflow-auto p-3"
        >
          <pre className="select-text whitespace-pre-wrap break-words font-mono text-[11px] leading-4 text-content/80">
            {message}
          </pre>
        </Popover>
      ) : null}
    </>
  );
}
