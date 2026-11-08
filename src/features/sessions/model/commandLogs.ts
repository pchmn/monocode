import type { Block } from "./session";

const BACKGROUND_ROW_PREFIX = "background:";
const STARTED_IN_BACKGROUND = /running in background with ID: ([\w-]+)/;
// Last stdout redirection to a file: `> f`, `>> f`, `1> f`, `&> f`; not `2> f` nor `>&1`.
const STDOUT_REDIRECT =
  /(?:^|[^\d&>])(?:&>>?|1?>>?)\s*("[^"]+"|'[^']+'|[^\s;&|<>]+)/g;

export function backgroundTaskId(block: Block): string | undefined {
  const callId = block.tool?.callId ?? "";
  if (callId.startsWith(BACKGROUND_ROW_PREFIX)) {
    return callId.slice(BACKGROUND_ROW_PREFIX.length) || undefined;
  }
  return block.tool?.detail?.match(STARTED_IN_BACKGROUND)?.[1];
}

/** Where Claude writes the task's output, as its Bash call reported it. */
export function taskOutputFile(
  blocks: readonly Block[],
  taskId: string,
): string | undefined {
  const pattern = new RegExp(
    `Output is being written to: (\\S+?/tasks/${escapeRegExp(taskId)}\\.output)`,
  );
  for (const block of blocks) {
    const found = block.tool?.detail?.match(pattern)?.[1];
    if (found) return found;
  }
  return undefined;
}

/** The file a command sends its own stdout to, which leaves Claude's empty. */
export function redirectTarget(command: string): string | undefined {
  let target: string | undefined;
  for (const match of command.matchAll(STDOUT_REDIRECT)) {
    target = match[1].replace(/^(["'])(.*)\1$/, "$2");
  }
  return target === "/dev/null" ? undefined : target;
}

export function redirectedLogFile(
  command: string,
  cwd?: string,
): string | undefined {
  const target = redirectTarget(command);
  if (!target) return undefined;
  if (target.startsWith("/") || target.startsWith("~")) return target;
  const base = commandDirectory(command) ?? cwd;
  return base ? `${base.replace(/\/+$/, "")}/${target}` : undefined;
}

function commandDirectory(command: string): string | undefined {
  const dir = command.match(/^\s*cd\s+("[^"]+"|'[^']+'|\S+)\s*&&/)?.[1];
  const unquoted = dir?.replace(/^(["'])(.*)\1$/, "$2");
  return unquoted?.startsWith("/") ? unquoted : undefined;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
