import { invoke } from "@tauri-apps/api/core";
import { ask } from "@tauri-apps/plugin-dialog";
import { REMOTE_PATH_PREFIX } from "../../../shared/lib/remotePaths";

type ProjectSaveCommand = {
  settingsPath: string;
  settingsHash: string;
  root: string;
  commands: string[];
  command: string;
};

const TRUST_KEY = "monocode.projectSettingsTrust";
const declined = new Set<string>();
const pendingPrompts = new Map<string, Promise<boolean>>();

function findSaveCommand(path: string) {
  if (path.startsWith(REMOTE_PATH_PREFIX)) return Promise.resolve(null);
  return invoke<ProjectSaveCommand | null>("project_save_command", { path });
}

/** True when a `.monocode/settings.json` `onSave` rule covers `path`. */
export async function hasProjectSaveCommand(path: string): Promise<boolean> {
  try {
    return (await findSaveCommand(path)) !== null;
  } catch {
    return false;
  }
}

/**
 * Runs the `onSave` command for `path` once the file is written, then calls
 * `reload` so the editor picks up what it changed. Returns the error to show.
 */
export async function runProjectSaveCommand(
  path: string,
  reload: () => Promise<void>,
): Promise<string | null> {
  try {
    const found = await findSaveCommand(path);
    if (!found || !(await isTrusted(found))) return null;
    await invoke("project_run_save_command", {
      root: found.root,
      command: found.command,
    });
    await reload();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function loadTrust(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(TRUST_KEY) ?? "{}");
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

function isTrusted(found: ProjectSaveCommand): Promise<boolean> {
  if (loadTrust()[found.settingsPath] === found.settingsHash) {
    return Promise.resolve(true);
  }
  const key = `${found.settingsPath}\n${found.settingsHash}`;
  if (declined.has(key)) return Promise.resolve(false);
  // Back-to-back saves must share one dialog.
  let prompt = pendingPrompts.get(key);
  if (!prompt) {
    prompt = promptTrust(found, key).finally(() => pendingPrompts.delete(key));
    pendingPrompts.set(key, prompt);
  }
  return prompt;
}

async function promptTrust(
  found: ProjectSaveCommand,
  key: string,
): Promise<boolean> {
  const allowed = await ask(
    `${found.settingsPath} runs these commands when you save a file:\n\n` +
      found.commands.map((command) => `• ${command}`).join("\n") +
      "\n\nAllow them? You will be asked again whenever this file changes.",
    {
      title: "Run on-save commands?",
      kind: "warning",
      okLabel: "Allow",
      cancelLabel: "Don't Allow",
    },
  );
  if (allowed) {
    localStorage.setItem(
      TRUST_KEY,
      JSON.stringify({
        ...loadTrust(),
        [found.settingsPath]: found.settingsHash,
      }),
    );
  } else {
    declined.add(key);
  }
  return allowed;
}
