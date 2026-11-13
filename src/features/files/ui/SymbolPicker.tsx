import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Search } from "../../../shared/ui/icons";
import { LAYER } from "../../../shared/lib/layers";
import { MatchText } from "../../../shared/ui/MatchText";
import { useLockOverscroll } from "../../../shared/hooks/useLockOverscroll";
import {
  documentSymbols,
  rankSymbols,
  symbolBadge,
  workspaceSymbols,
  type LspSymbol,
  type RankedSymbol,
} from "../model/lspSymbols";
import { documentText, type ScriptEditor } from "../editor/editorLspNavigation";
import { openLocation } from "../editor/editorGoToDefinition";

const WORKSPACE_DEBOUNCE_MS = 150;

type Props = {
  scope: "document" | "workspace";
  source: ScriptEditor | null;
  onClose: () => void;
};

export function SymbolPicker({ scope, source, onClose }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [symbols, setSymbols] = useState<LspSymbol[]>([]);
  const [loading, setLoading] = useState(Boolean(source));
  const [error, setError] = useState<string | null>(null);
  const title =
    scope === "document" ? "Go to Symbol in File" : "Go to Symbol in Workspace";

  useEffect(() => {
    input.current?.focus();
  }, []);

  useEffect(() => {
    if (!source || scope !== "document") return;
    let cancelled = false;
    documentSymbols(documentText(source))
      .then((next) => !cancelled && setSymbols(next))
      .catch((err: unknown) => !cancelled && setError(String(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [scope, source]);

  useEffect(() => {
    if (!source || scope !== "workspace") return;
    const trimmed = query.trim();
    if (!trimmed) {
      setSymbols([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      workspaceSymbols(documentText(source), trimmed)
        .then((next) => {
          if (cancelled) return;
          setSymbols(next);
          setError(null);
        })
        .catch((err: unknown) => !cancelled && setError(String(err)))
        .finally(() => !cancelled && setLoading(false));
    }, WORKSPACE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [scope, source, query]);

  const results = useMemo(() => rankSymbols(symbols, query), [symbols, query]);

  useEffect(() => {
    setActive((index) => Math.min(index, Math.max(results.length - 1, 0)));
  }, [results.length]);

  const close = () => {
    onClose();
    source?.view.focus();
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

  const pick = (symbol: RankedSymbol) => {
    onClose();
    openLocation(source?.view ?? null, source?.path ?? null, symbol);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    const count = results.length;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!count) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => (index + step + count) % count);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const symbol = results[active];
      if (symbol) pick(symbol);
    }
  };

  const empty = emptyLabel({
    scope,
    hasSource: Boolean(source),
    query,
    loading,
    error,
    count: results.length,
  });

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: LAYER.dialog }}>
      <div className="absolute inset-0" onMouseDown={close} />
      <div
        role="dialog"
        aria-label={title}
        data-file-picker
        onMouseDown={(event) => event.stopPropagation()}
        className="absolute left-1/2 top-[12%] flex w-[min(560px,calc(100vw-24px))] -translate-x-1/2 flex-col overflow-hidden rounded-lg border border-content/10 bg-content/5 backdrop-blur-xl"
      >
        <div className="pb-1.5">
          <label className="flex items-center gap-2 border-b border-stroke px-2 py-2.5 text-content/50">
            <Search className="size-3.5 shrink-0" strokeWidth={1.75} />
            <input
              ref={input}
              type="text"
              value={query}
              placeholder={title}
              aria-label={title}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-content outline-none placeholder:text-content/40"
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
            />
          </label>
        </div>
        {empty ? (
          <p className="px-3 pb-3 pt-1 text-[12px] text-content/50">{empty}</p>
        ) : (
          <SymbolList
            symbols={results}
            active={active}
            highlight={Boolean(query.trim())}
            showFile={scope === "workspace"}
            onActive={setActive}
            onPick={pick}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}

function emptyLabel({
  scope,
  hasSource,
  query,
  loading,
  error,
  count,
}: {
  scope: Props["scope"];
  hasSource: boolean;
  query: string;
  loading: boolean;
  error: string | null;
  count: number;
}): string | null {
  if (!hasSource) return "Open a TypeScript or JavaScript file first";
  if (count > 0) return null;
  if (error) return error;
  if (loading) return "Loading symbols…";
  if (scope === "workspace" && !query.trim()) return "Type a symbol name";
  return query.trim() ? "No matching symbols" : "No symbols in this file";
}

function SymbolList({
  symbols,
  active,
  highlight,
  showFile,
  onActive,
  onPick,
}: {
  symbols: RankedSymbol[];
  active: number;
  highlight: boolean;
  showFile: boolean;
  onActive: (index: number) => void;
  onPick: (symbol: RankedSymbol) => void;
}) {
  const lockOverscroll = useLockOverscroll<HTMLDivElement>();
  const activeRef = useRef<HTMLButtonElement>(null);
  // Rows scrolled under a still pointer must not steal the keyboard selection.
  const pointerMoved = useRef(false);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <div
      ref={lockOverscroll}
      role="listbox"
      aria-label="Symbols"
      onMouseMove={() => {
        pointerMoved.current = true;
      }}
      onWheel={() => {
        pointerMoved.current = false;
      }}
      className="max-h-[min(380px,50vh)] overflow-y-auto overscroll-none px-1.5 pb-1.5"
    >
      {symbols.map((symbol, index) => {
        const highlighted = index === active;
        const badge = symbolBadge(symbol.kind);
        const detail = showFile
          ? [symbol.container, symbol.relative].filter(Boolean).join(" · ")
          : symbol.container;
        return (
          <button
            key={`${symbol.path}:${symbol.line}:${symbol.character}:${symbol.name}`}
            ref={highlighted ? activeRef : undefined}
            type="button"
            role="option"
            aria-selected={highlighted}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => pointerMoved.current && onActive(index)}
            onClick={() => onPick(symbol)}
            className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm leading-none ${
              highlighted ? "bg-selection text-content" : "text-content"
            }`}
          >
            <span
              title={badge.label}
              aria-label={badge.label}
              className={`w-4 shrink-0 text-center font-mono text-[12px] ${badge.className}`}
            >
              {badge.glyph}
            </span>
            <span className="min-w-0 shrink truncate">
              <MatchText
                text={symbol.name}
                positions={symbol.positions}
                active={highlight}
              />
            </span>
            {detail ? (
              <span className="ml-auto min-w-0 max-w-[55%] truncate font-mono text-[11px] text-content/40">
                {detail}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
