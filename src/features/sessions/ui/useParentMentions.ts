import { useEffect, useMemo, useState } from "react";
import type { RankedFile } from "../../files/model/fileIndex";
import {
  parentMentionQuery,
  rankParentEntries,
} from "../../files/model/parentMentions";
import { listDir, type FsEntry } from "../../../platform/tauri/fs";

/** Picker rows for an `@../…` query, or null when the query is not a parent one. */
export function useParentMentions(
  enabled: boolean,
  cwd: string,
  query: string,
): RankedFile[] | null {
  const parentQuery = useMemo(
    () => (enabled ? parentMentionQuery(query, cwd) : null),
    [cwd, enabled, query],
  );
  const parentDir = parentQuery?.dir;
  const [entries, setEntries] = useState<FsEntry[]>([]);
  useEffect(() => {
    if (!parentDir) return;
    let cancelled = false;
    listDir(parentDir)
      .then((list) => !cancelled && setEntries(list))
      .catch(() => !cancelled && setEntries([]));
    return () => {
      cancelled = true;
    };
  }, [parentDir]);
  return useMemo(
    () =>
      parentQuery
        ? rankParentEntries(entries, parentQuery.prefix, parentQuery.filter)
        : null,
    [entries, parentQuery],
  );
}

export function parentMentionPick(
  query: string,
  file: { relative: string; isDir?: boolean },
): { label: string; intoDir: boolean } | null {
  if (!query.startsWith("../")) return null;
  const intoDir = Boolean(file.isDir);
  return { label: file.relative + (intoDir ? "/" : ""), intoDir };
}
