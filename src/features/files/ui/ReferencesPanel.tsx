import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { LoaderCircle } from "../../../shared/ui/icons";
import { LAYER } from "../../../shared/lib/layers";
import { useLockOverscroll } from "../../../shared/hooks/useLockOverscroll";
import type { ProjectSearchMatch } from "../../search/model/search";
import { groupMatches } from "../../projects/ui/ProjectSearch";
import { findReferences } from "../model/lspSymbols";
import type { ScriptEditor } from "../editor/editorLspNavigation";
import { openLocation, positionRequest } from "../editor/editorGoToDefinition";
import { FileTypeIcon } from "./FileTypeIcon";

type Props = {
  source: ScriptEditor;
  pos: number;
  onClose: () => void;
};

export function ReferencesPanel({ source, pos, onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const lockOverscroll = useLockOverscroll<HTMLDivElement>();
  const [references, setReferences] = useState<ProjectSearchMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const symbol = useMemo(() => {
    const word = source.view.state.wordAt(pos);
    return word ? source.view.state.sliceDoc(word.from, word.to) : "";
  }, [source, pos]);

  useEffect(() => {
    panel.current?.focus();
    let cancelled = false;
    findReferences(positionRequest(source.view, source.path, pos))
      .then((next) => !cancelled && setReferences(next))
      .catch((err: unknown) => !cancelled && setError(String(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [source, pos]);

  const groups = useMemo(() => groupMatches(references), [references]);
  // Keyboard order follows the grouped display, not the server's order.
  const ordered = useMemo(
    () => groups.flatMap((group) => group.matches),
    [groups],
  );

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const close = () => {
    onClose();
    source.view.focus();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  const open = (reference: ProjectSearchMatch) => {
    onClose();
    openLocation(source.view, source.path, {
      path: reference.path,
      line: reference.line - 1,
      character: reference.column - 1,
    });
  };

  const onKeyDown = (event: ReactKeyboardEvent) => {
    const count = ordered.length;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!count) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => (index + step + count) % count);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const reference = ordered[active];
      if (reference) open(reference);
    }
  };

  const fileCount = groups.length;
  const status = loading
    ? null
    : error
      ? error
      : references.length === 0
        ? "No references found"
        : `${references.length} reference${references.length === 1 ? "" : "s"} in ${fileCount} file${fileCount === 1 ? "" : "s"}`;

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: LAYER.dialog }}>
      <div className="absolute inset-0" onMouseDown={close} />
      <div
        ref={panel}
        role="dialog"
        aria-label={`References to ${symbol}`}
        data-file-picker
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
        className="absolute left-1/2 top-[12%] flex max-h-[70vh] w-[min(640px,calc(100vw-24px))] -translate-x-1/2 flex-col overflow-hidden rounded-lg border border-content/10 bg-content/5 outline-none backdrop-blur-xl"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-stroke px-3 py-2.5 text-[12px]">
          <span className="min-w-0 truncate text-content">
            References to <span className="font-mono">{symbol}</span>
          </span>
          <span className="ml-auto shrink-0 text-content/45">
            {loading ? (
              <LoaderCircle
                className="size-3 animate-spin"
                strokeWidth={1.75}
              />
            ) : (
              status
            )}
          </span>
        </div>
        <div
          ref={lockOverscroll}
          role="listbox"
          aria-label="References"
          className="min-h-0 flex-1 overflow-y-auto overscroll-none"
        >
          {groups.map((group) => (
            <section
              key={group.path}
              className="border-b border-stroke last:border-b-0"
            >
              <div className="flex items-center gap-1.5 px-2 pt-1.5">
                <FileTypeIcon name={group.name} isDir={false} size={16} />
                <span className="shrink-0 text-[12px] text-content">
                  {group.name}
                </span>
                <span
                  className="min-w-0 flex-1 truncate text-[10px] text-content/40"
                  title={group.relative}
                >
                  {group.relative}
                </span>
                <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] tabular-nums text-accent">
                  {group.matches.length}
                </span>
              </div>
              <ul className="py-1">
                {group.matches.map((reference) => {
                  const index = ordered.indexOf(reference);
                  const highlighted = index === active;
                  return (
                    <li
                      key={`${reference.path}:${reference.line}:${reference.column}`}
                    >
                      <button
                        ref={highlighted ? activeRef : undefined}
                        type="button"
                        role="option"
                        aria-selected={highlighted}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => open(reference)}
                        className={`flex w-full items-start gap-2 px-2 py-0.5 text-left ${
                          highlighted ? "bg-selection" : "hover:bg-content/5"
                        }`}
                      >
                        <span className="w-8 shrink-0 pt-px text-right font-mono text-[11px] tabular-nums text-content/35">
                          {reference.line}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-mono text-[11px] leading-5 text-content/80">
                          <ReferencePreview
                            reference={reference}
                            length={symbol.length}
                          />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ReferencePreview({
  reference,
  length,
}: {
  reference: ProjectSearchMatch;
  length: number;
}) {
  const preview = reference.preview.trimEnd();
  const indent = preview.length - preview.trimStart().length;
  const start = reference.column - 1 - indent;
  const text = preview.trimStart();
  if (!length || start < 0 || start >= text.length) return <>{text}</>;
  return (
    <>
      {text.slice(0, start)}
      <mark className="rounded-sm bg-accent/35 text-content">
        {text.slice(start, start + length)}
      </mark>
      {text.slice(start + length)}
    </>
  );
}
