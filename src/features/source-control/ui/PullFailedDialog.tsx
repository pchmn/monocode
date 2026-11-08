import { Modal } from "../../../shared/ui/Modal";
import { Loader } from "../../../shared/ui/icons";

type Props = {
  error: string;
  /** Git refused because the pull would overwrite local changes. */
  blockedByChanges: boolean;
  stashing: boolean;
  onStashAndPull: () => void;
  onClose: () => void;
};

export function PullFailedDialog({
  error,
  blockedByChanges,
  stashing,
  onStashAndPull,
  onClose,
}: Props) {
  const close = () => {
    if (!stashing) onClose();
  };
  return (
    <Modal
      size="sm"
      title={blockedByChanges ? "Uncommitted changes" : "Pull failed"}
      onClose={close}
    >
      <div className="flex flex-col gap-3 px-4 pt-2 pb-4">
        {blockedByChanges ? (
          <p className="text-[12px] leading-snug text-content/55">
            Pulling would overwrite your local changes. Stash them and pull;
            restore them later with <code>git stash pop</code>.
          </p>
        ) : null}
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-content/5 p-2 font-mono text-[11px] leading-4 text-red-400/90">
          {error}
        </pre>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={stashing}
            onClick={close}
            className="rounded-md px-3 py-1.5 text-[12px] text-content/70 hover:bg-content/8 hover:text-content disabled:opacity-40"
          >
            {blockedByChanges ? "Cancel" : "Close"}
          </button>
          {blockedByChanges ? (
            <button
              type="button"
              disabled={stashing}
              onClick={onStashAndPull}
              className="inline-flex items-center gap-1.5 rounded-md bg-content px-3 py-1.5 text-[12px] font-medium text-background-base hover:bg-content/80 disabled:opacity-40"
            >
              {stashing ? (
                <Loader className="size-3.5 animate-spin" strokeWidth={1.75} />
              ) : null}
              Stash & pull
            </button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
