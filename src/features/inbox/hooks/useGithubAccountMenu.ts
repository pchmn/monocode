import { useEffect, useState } from "react";
import { GitPullRequest } from "../../../shared/ui/icons";
import type { TabGroupMenuExtraItem } from "../../workspace/ui/TabGroupMenu";
import {
  codeWorkspaceFolders,
  isCodeWorkspace,
  loadCodeWorkspace,
} from "../../projects/model/codeWorkspace";
import {
  githubAccounts,
  githubProjectAccount,
  setGithubProjectAccount,
} from "../model/githubAccounts";
import { clearInboxCache } from "../model/githubTasks";

const ACTION = "github-account:";

/** "GitHub account" submenu of a project's menu; absent with fewer than two `gh` accounts or outside a git repo. */
export function useGithubAccountMenu(path: string | undefined) {
  const [state, setState] = useState<{
    accounts: string[];
    current: string | null;
  } | null>(null);

  useEffect(() => {
    setState(null);
    if (!path) return;
    let active = true;
    Promise.all([
      githubAccounts(),
      accountRepos(path).then((repos) =>
        githubProjectAccount(repos[0] ?? path),
      ),
    ])
      .then(([accounts, current]) => {
        if (active) setState({ accounts, current });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [path]);

  const item: TabGroupMenuExtraItem | null =
    state && state.accounts.length > 1
      ? {
          id: "github-account",
          label: "GitHub account",
          icon: GitPullRequest,
          submenu: [
            {
              kind: "item",
              id: ACTION,
              label: "Active gh account",
              checked: state.current === null,
            },
            { kind: "sep" },
            ...state.accounts.map((login) => ({
              kind: "item" as const,
              id: `${ACTION}${login}`,
              label: login,
              checked: state.current === login,
            })),
          ],
        }
      : null;

  const pick = (action: string) => {
    if (!path || !action.startsWith(ACTION)) return;
    const login = action.slice(ACTION.length) || null;
    void accountRepos(path)
      .then((repos) =>
        Promise.allSettled(
          repos.map((repo) => setGithubProjectAccount(repo, login)),
        ),
      )
      .then(() => {
        // Repos found, or missed, with the previous account are cached.
        clearInboxCache();
        setState((prev) => prev && { ...prev, current: login });
      })
      .catch((error: unknown) => console.error(error));
  };

  return { item, pick };
}

export function withGithubAccountItem(
  items: TabGroupMenuExtraItem[],
  item: TabGroupMenuExtraItem | null,
): TabGroupMenuExtraItem[] {
  if (!item) return items;
  const at = items.findIndex((entry) => entry.id === "external-editor") + 1;
  return [...items.slice(0, at), item, ...items.slice(at)];
}

// A VS Code workspace is a file: the choice goes to every folder's repo, read back from the first.
async function accountRepos(project: string): Promise<string[]> {
  if (!isCodeWorkspace(project)) return [project];
  const folders =
    codeWorkspaceFolders(project) ?? (await loadCodeWorkspace(project));
  return folders.map((folder) => folder.path);
}
