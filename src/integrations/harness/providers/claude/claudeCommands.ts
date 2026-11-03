import { listSkills } from "../../../../platform/tauri/fs";
import {
  BUILTIN_CREATE_SKILL,
  loadDisabledSkillPaths,
  mergeCatalog,
  readSkillBody,
  skillNamesInText,
  type BuiltinSkill,
  type FileSkill,
} from "../../../../features/skills/model/skills";
import {
  nativeCommandInvocation,
  type CommandContext,
  type NativeCommand,
  type NativeCommandProvider,
} from "../../core/nativeCommands";

// MonoCode runs its own clear/compact/mcp; the rest only make sense in the terminal UI.
const HIDDEN_COMMANDS = new Set([
  "clear",
  "compact",
  "mcp",
  "autocompact",
  "color",
  "config",
  "effort",
  "fast",
  "focus",
  "heapdump",
  "model",
  "output-style",
  "rename",
  "agents",
  "extra-usage",
  "workflow-launch-exec",
]);

type DiskSkill = FileSkill | BuiltinSkill;

const cliCommandsBySession = new Map<string, NativeCommand[]>();
const listeners = new Set<(sessionId: string) => void>();

export function claudeCommandsFromControlResponse(
  rec: Record<string, unknown>,
): NativeCommand[] | null {
  const outer = asRecord(rec.response);
  const raw = asRecord(outer?.response)?.commands;
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  return raw.flatMap((item): NativeCommand[] => {
    const cmd = asRecord(item);
    const name = typeof cmd?.name === "string" ? cmd.name.trim() : "";
    if (!name || name.startsWith("_") || HIDDEN_COMMANDS.has(name)) return [];
    if (seen.has(name)) return [];
    seen.add(name);
    const hint = typeof cmd?.argumentHint === "string" ? cmd.argumentHint : "";
    return [
      {
        name,
        description: String(cmd?.description ?? "").trim(),
        invocation: nativeCommandInvocation("claude", name),
        source: "claude",
        ...(hint ? { inputHint: hint } : {}),
      },
    ];
  });
}

export function noteClaudeCommands(
  sessionId: string,
  rec: Record<string, unknown>,
): void {
  const commands = claudeCommandsFromControlResponse(rec);
  if (!commands) return;
  cliCommandsBySession.set(sessionId, commands);
  for (const listener of listeners) listener(sessionId);
}

async function diskSkills(cwd: string): Promise<{
  enabled: DiskSkill[];
  disabledNames: Set<string>;
}> {
  const disabledPaths = new Set(loadDisabledSkillPaths());
  const all = await listSkills(cwd).catch(() => []);
  const disabledNames = new Set(
    all.filter((s) => disabledPaths.has(s.path)).map((s) => s.name),
  );
  const enabled = mergeCatalog(
    all.filter((s) => !disabledPaths.has(s.path)),
  ).filter((s): s is DiskSkill => s.kind === "file" || s.kind === "builtin");
  return { enabled, disabledNames };
}

/** CLI commands first; disk skills the CLI does not know fill the gaps. */
export function mergeClaudeCommands(
  cli: NativeCommand[] | undefined,
  disk: DiskSkill[],
  disabledNames: ReadonlySet<string>,
): NativeCommand[] {
  const out = (cli ?? []).filter((cmd) => !disabledNames.has(cmd.name));
  const known = new Set(out.map((cmd) => cmd.name));
  for (const skill of disk) {
    if (known.has(skill.name)) continue;
    known.add(skill.name);
    out.push({
      name: skill.name,
      description: skill.description,
      invocation: skill.invocation,
      source: "claude",
      origin: skill.kind === "builtin" ? "MonoCode" : skill.source,
    });
  }
  return out;
}

async function discover(context: CommandContext): Promise<NativeCommand[]> {
  const cli = context.sessionId
    ? cliCommandsBySession.get(context.sessionId)
    : undefined;
  const { enabled, disabledNames } = await diskSkills(context.cwd);
  return mergeClaudeCommands(cli, enabled, disabledNames);
}

export const claudeCommandProvider: NativeCommandProvider = {
  discover,
  subscribe(context, onCommands) {
    let stopped = false;
    const push = () => {
      void discover(context).then((commands) => {
        if (!stopped) onCommands(commands);
      });
    };
    if (context.sessionId && cliCommandsBySession.has(context.sessionId)) push();
    const listener = (sessionId: string) => {
      if (sessionId === context.sessionId) push();
    };
    listeners.add(listener);
    return () => {
      stopped = true;
      listeners.delete(listener);
    };
  },
};

/** Inline the body of `/skills` the CLI cannot resolve itself (e.g. `.agents/skills`). */
export async function withClaudeDiskSkills(
  sessionId: string,
  text: string,
  cwd: string,
): Promise<string> {
  const names = skillNamesInText(text);
  if (names.length === 0) return text;
  const cli = new Set(
    (cliCommandsBySession.get(sessionId) ?? []).map((cmd) => cmd.name),
  );
  const missing = names.filter((name) => !cli.has(name));
  if (missing.length === 0) return text;
  const { enabled } = await diskSkills(cwd);
  const picked = missing.flatMap((name) => {
    const skill =
      enabled.find((s) => s.name === name) ??
      (name === BUILTIN_CREATE_SKILL.name ? BUILTIN_CREATE_SKILL : undefined);
    return skill ? [skill] : [];
  });
  if (picked.length === 0) return text;
  const blocks = await Promise.all(
    picked.map(async (skill) => {
      const body = (await readSkillBody(skill)).trim();
      const where = skill.kind === "file" ? `\n\n(Skill file: ${skill.path})` : "";
      return `## /${skill.name}\n\n${body}${where}`;
    }),
  );
  // Appended so a leading CLI command stays first and still gets recognised.
  return [
    text,
    "",
    "---",
    "The user invoked the skill(s) below with /name. Follow every instruction in each skill body.",
    "",
    blocks.join("\n\n"),
  ].join("\n");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
