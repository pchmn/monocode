import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import type { GithubWorkItem } from "../../inbox/model/githubTasks";
import {
  issueTokenAt,
  loadIssueMentionItems,
  rankIssues,
  replaceIssueToken,
  type IssueMentionToken,
  type RankedIssue,
} from "../model/issueMentions";

type Options = {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  cwd: string;
  enabled: boolean;
  /** Called after the textarea value changed, to sync the composer's draft state. */
  onReplace: (el: HTMLTextAreaElement, next: string) => void;
};

export function useIssueMentions({ inputRef, cwd, enabled, onReplace }: Options) {
  const [token, setToken] = useState<IssueMentionToken | null>(null);
  const [active, setActive] = useState(0);
  const [items, setItems] = useState<GithubWorkItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const open = enabled && token !== null;

  useEffect(() => {
    setItems(null);
    setError(null);
  }, [cwd]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadIssueMentionItems(cwd).then(
      (next) => {
        if (!cancelled) setItems(next);
      },
      (err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [cwd, open]);

  const ranked = useMemo<RankedIssue[]>(
    () => (open && items ? rankIssues(items, token?.query ?? "") : []),
    [items, open, token?.query],
  );

  useEffect(() => setActive(0), [token?.query]);

  const sync = useCallback(
    (el: HTMLTextAreaElement) => {
      setToken(enabled ? issueTokenAt(el.value, el.selectionStart ?? 0) : null);
    },
    [enabled],
  );

  const close = useCallback(() => setToken(null), []);

  const pick = useCallback(
    (item: GithubWorkItem) => {
      const el = inputRef.current;
      const current = tokenRef.current;
      setToken(null);
      if (!el || !current) return;
      const { text, cursor } = replaceIssueToken(el.value, current, item.number);
      el.value = text;
      el.setSelectionRange(cursor, cursor);
      onReplace(el, text);
      el.focus();
    },
    [inputRef, onReplace],
  );

  /** Returns true when the key was consumed by the picker. */
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!open) return false;
    const count = ranked.length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (count > 0) {
        const step = e.key === "ArrowDown" ? 1 : -1;
        setActive((index) => (index + step + count) % count);
      }
      return true;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setToken(null);
      return true;
    }
    if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
      const item = ranked[active];
      if (item) {
        e.preventDefault();
        pick(item);
        return true;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        return true;
      }
      setToken(null);
    }
    return false;
  };

  return {
    open,
    query: token?.query ?? "",
    items: ranked,
    loading: open && items === null && error === null,
    error,
    active,
    setActive,
    sync,
    close,
    pick,
    onKeyDown,
  };
}
