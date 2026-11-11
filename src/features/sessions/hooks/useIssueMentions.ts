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
  loadIssueScope,
  rankIssues,
  replaceIssueToken,
  saveIssueScope,
  searchIssueMentionItems,
  type IssueMentionToken,
  type IssueScope,
  type RankedIssue,
} from "../model/issueMentions";

const SEARCH_DELAY_MS = 300;

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
  const [scope, setScopeState] = useState<IssueScope>(loadIssueScope);
  const [remote, setRemote] = useState<{ query: string; items: GithubWorkItem[] }>();
  const [searching, setSearching] = useState(false);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const open = enabled && token !== null;

  const setScope = useCallback((next: IssueScope) => {
    saveIssueScope(next);
    setScopeState(next);
  }, []);

  useEffect(() => {
    setItems(null);
    setError(null);
    setRemote(undefined);
  }, [cwd, scope]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadIssueMentionItems(cwd, scope).then(
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
  }, [cwd, open, scope]);

  const query = token?.query.trim() ?? "";
  useEffect(() => {
    if (!open || !query) {
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      searchIssueMentionItems(cwd, scope, query)
        .then(
          (found) => {
            if (!cancelled) setRemote({ query, items: found });
          },
          () => undefined,
        )
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cwd, open, query, scope]);

  const ranked = useMemo<RankedIssue[]>(() => {
    if (!open || !items) return [];
    const extra = remote?.query === query ? remote.items : [];
    return rankIssues(items, query, extra);
  }, [items, open, query, remote]);

  useEffect(() => setActive(0), [token?.query, scope]);

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
    // Option+A, matched on `code` since macOS turns the key into "å".
    if (e.altKey && e.code === "KeyA") {
      e.preventDefault();
      setScope(scope === "open" ? "all" : "open");
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
    searching,
    error,
    scope,
    setScope,
    active,
    setActive,
    sync,
    close,
    pick,
    onKeyDown,
  };
}
