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

/** Sessions still on the project checkout (or workspace folder) whose conversation can follow them. */
export function canAdoptAgentWorktree(session: Session): boolean {
  return (
    RESUMES_ACROSS_CWD.has(session.harness) &&
    !!session.providerSessionId &&
    !session.busy &&
    !hasOwnWorktree(session) &&
    !session.worktreeRemoved &&
    !session.workspaceMode &&
    !session.pendingSwitch &&
    !session.queuedMessages?.length
  );
}
