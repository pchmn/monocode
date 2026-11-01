import { invoke } from "@tauri-apps/api/core";

/** Accounts signed in to the GitHub CLI on github.com. */
export function githubAccounts(): Promise<string[]> {
  return invoke<string[]>("github_accounts");
}

/** `null` when the project uses the active `gh` account. */
export function githubProjectAccount(cwd: string): Promise<string | null> {
  return invoke<string | null>("github_project_account", { cwd });
}

export function setGithubProjectAccount(
  cwd: string,
  login: string | null,
): Promise<void> {
  return invoke<void>("set_github_project_account", { cwd, login });
}
