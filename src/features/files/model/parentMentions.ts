import { rankProjectFiles, type RankedFile } from "./fileIndex";
import { isTokenSafe, MAX_PICKER } from "./fileMentions";
import type { FsEntry } from "../../../platform/tauri/fs";
import { joinPath } from "../../../shared/lib/paths";

/** `../foo/ba` → directory to list (relative to `cwd`), label prefix and name filter. */
export function parentMentionQuery(
  query: string,
  cwd: string,
): { dir: string; prefix: string; filter: string } | null {
  if (!query.startsWith("../")) return null;
  const cut = query.lastIndexOf("/") + 1;
  const prefix = query.slice(0, cut);
  return { dir: joinPath(cwd, prefix), prefix, filter: query.slice(cut) };
}

/** Entries of a parent directory as picker rows; `relative` is the label to write. */
export function rankParentEntries(
  entries: FsEntry[],
  prefix: string,
  filter: string,
): RankedFile[] {
  const files = entries
    .filter((entry) => isTokenSafe(entry.name))
    .map((entry) => ({ ...entry, relative: entry.name }));
  const hits = filter
    ? rankProjectFiles(files, filter, [], MAX_PICKER)
    : files
        .sort(
          (a, b) =>
            Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name),
        )
        .slice(0, MAX_PICKER)
        .map((file) => ({ ...file, score: 0, positions: [] }));
  return hits.map((hit) => ({ ...hit, relative: prefix + hit.name }));
}

export function parentMentionLines(text: string, cwd: string): string[] {
  const lines: string[] = [];
  for (const [, token] of text.matchAll(/(?:^|\s)@(\.\.\/\S*)/g)) {
    const label = token!.replace(/[,;:!?)\]}"'.]+$/, "");
    lines.push(`- @${label} → ${joinPath(cwd, label)}`);
  }
  return lines;
}
