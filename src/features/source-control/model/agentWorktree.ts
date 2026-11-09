import { isExecuteTool } from "../../../integrations/harness/core/preview";
import { hasOwnWorktree } from "../../projects/model/workspaceFolderWorktrees";
import { joinPath, pathKey } from "../../../shared/lib/paths";
import type { Block, HarnessId, Session } from "../../sessions/model/session";
import type { Worktree } from "./worktrees";

/** A worktree the agent created from its shell: resolved when its cwd is known. */
export type AgentWorktreeCandidate = { path?: string; raw: string };

// Providers whose conversation resumes from another cwd (checked on Claude Code 2.1).
const RESUMES_ACROSS_CWD = new Set<HarnessId>(["claude", "codex"]);

const OPERATORS = new Set(["&&", "||", ";", "|", "&", "\n", "(", ")"]);
const VALUE_OPTIONS = new Set(["-b", "-B", "--reason"]);

function tokenize(command: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let started = false;
  let quote: '"' | "'" | null = null;
  const flush = () => {
    if (started) tokens.push(current);
    current = "";
    started = false;
  };
  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    if (quote) {
      if (char === quote) quote = null;
      else if (char === "\\" && quote === '"' && i + 1 < command.length)
        current += command[++i];
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (char === "\\" && i + 1 < command.length) {
      const next = command[++i];
      if (next !== "\n") {
        current += next;
        started = true;
      }
    } else if (char === "\n" || char === ";" || char === "(" || char === ")") {
      flush();
      tokens.push(char);
    } else if (char === "&" || char === "|") {
      flush();
      const doubled = command[i + 1] === char;
      if (doubled) i++;
      tokens.push(doubled ? char + char : char);
    } else if (/\s/.test(char)) {
      flush();
    } else {
      current += char;
      started = true;
    }
  }
  flush();
  return tokens;
}

function resolve(base: string | null, dir: string): string | null {
  if (dir.startsWith("/")) return joinPath("/", dir);
  if (!base || dir.startsWith("~") || dir.includes("$")) return null;
  return joinPath(base, dir);
}

function worktreeAddPath(args: string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") return args[i + 1];
    if (VALUE_OPTIONS.has(arg)) i++;
    else if (!arg.startsWith("-")) return arg;
  }
  return undefined;
}

/** Paths a shell command passes to `git worktree add`, resolved against `cwd`. */
export function worktreeAddTargets(
  command: string,
  cwd: string,
): AgentWorktreeCandidate[] {
  if (!/\bworktree\b/.test(command)) return [];
  const found: AgentWorktreeCandidate[] = [];
  let dir: string | null = cwd;
  let segment: string[] = [];
  const visit = (words: string[]) => {
    while (words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0]))
      words = words.slice(1);
    if (words[0] === "cd") {
      dir = words[1] ? resolve(dir, words[1]) : null;
      return;
    }
    if (words[0] !== "git") return;
    let gitDir = dir;
    let i = 1;
    while (i < words.length && words[i].startsWith("-")) {
      if (words[i] === "-C") gitDir = resolve(gitDir, words[++i] ?? "");
      else if (words[i] === "-c") i++;
      i++;
    }
    if (words[i] !== "worktree" || words[i + 1] !== "add") return;
    const raw = worktreeAddPath(words.slice(i + 2));
    if (!raw || raw.includes("$")) return;
    const path = resolve(gitDir, raw);
    found.push(path ? { path, raw } : { raw });
  };
  for (const token of tokenize(command)) {
    if (OPERATORS.has(token)) {
      visit(segment);
      segment = [];
    } else segment.push(token);
  }
  visit(segment);
  return found;
}

// Claude Code's result: `Created worktree at “/abs/path”. The session is now working in the worktree.`
const ENTERED_WORKTREE = /worktree at [“"']?(\/[^”"'\n]+?)[”"']?(?:\.\s|\.?$|\s)/;

function enteredWorktree(block: Block): AgentWorktreeCandidate | undefined {
  const path = block.tool?.detail?.match(ENTERED_WORKTREE)?.[1];
  return path ? { path, raw: path } : undefined;
}

/** Every worktree a session's shell commands or worktree tools created, oldest first. */
export function agentWorktreeCandidates(
  blocks: readonly Block[],
  cwd: string,
): AgentWorktreeCandidate[] {
  let found: AgentWorktreeCandidate[] = [];
  for (const block of blocks) {
    if (block.role !== "tool" || block.tool?.status === "failed") continue;
    const kind = block.tool?.kind;
    if (kind === "ExitWorktree") {
      if (block.tool?.status === "completed") found = [];
      continue;
    }
    if (kind === "EnterWorktree") {
      const entered = enteredWorktree(block);
      if (entered) found.push(entered);
      continue;
    }
    const command = block.text || block.tool?.title || "";
    if (isExecuteTool(kind, command))
      found.push(...worktreeAddTargets(command, cwd));
  }
  return found;
}

function matches(candidate: AgentWorktreeCandidate, tree: Worktree): boolean {
  if (candidate.path && pathKey(candidate.path) === pathKey(tree.path))
    return true;
  // Symlinked roots (/tmp vs /private/tmp) or an unknown cwd: match on the tail.
  const tail = candidate.raw.replace(/^(\.\/)+/, "").replace(/\/+$/, "");
  if (!tail || tail.startsWith("/") || tail.startsWith("~") || tail.split("/").includes(".."))
    return false;
  return pathKey(tree.path).endsWith(`/${tail}`);
}

/** The most recent agent-created worktree that still exists. */
export function pickAgentWorktree(
  candidates: readonly AgentWorktreeCandidate[],
  worktrees: readonly Worktree[],
): Worktree | undefined {
  const live = worktrees.filter((tree) => !tree.isMain && !tree.missing);
  for (const candidate of [...candidates].reverse()) {
    const tree = live.find((entry) => matches(candidate, entry));
    if (tree) return tree;
  }
  return undefined;
}

function mentionsPath(text: string, path: string): boolean {
  for (let at = text.indexOf(path); at >= 0; at = text.indexOf(path, at + 1)) {
    // `/repo-a` must not match inside `/repo-a-b`.
    if (!/[\w.-]/.test(text[at + path.length] ?? "")) return true;
  }
  return false;
}

function blockMentions(block: Block, path: string): boolean {
  const texts = [block.text, block.tool?.title, block.tool?.detail, ...(block.tool?.paths ?? [])];
  return texts.some((text) => !!text && mentionsPath(text, path));
}

/**
 * A worktree that appeared during the turn (`before` holds the path keys listed at its start)
 * and that the turn's tool blocks point at: catches wrappers such as `pnpm worktree <branch>`.
 */
export function pickNewAgentWorktree(
  before: ReadonlySet<string>,
  worktrees: readonly Worktree[],
  turnBlocks: readonly Block[],
  claimed: ReadonlySet<string>,
): Worktree | undefined {
  const fresh = worktrees.filter((tree) => {
    const key = pathKey(tree.path);
    return !tree.isMain && !tree.missing && !before.has(key) && !claimed.has(key);
  });
  for (const block of [...turnBlocks].reverse()) {
    if (block.role !== "tool" || block.tool?.status === "failed") continue;
    const tree = fresh.find((entry) => blockMentions(block, entry.path));
    if (tree) return tree;
  }
  return undefined;
}

/** Sessions on the project checkout (or workspace folder) whose conversation could follow a worktree. */
export function followsAgentWorktrees(session: Session): boolean {
  return (
    RESUMES_ACROSS_CWD.has(session.harness) &&
    !hasOwnWorktree(session) &&
    !session.worktreeRemoved &&
    !session.workspaceMode
  );
}

export function canAdoptAgentWorktree(session: Session): boolean {
  return (
    followsAgentWorktrees(session) &&
    !!session.providerSessionId &&
    !session.busy &&
    !session.pendingSwitch &&
    !session.queuedMessages?.length
  );
}
