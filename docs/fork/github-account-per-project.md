# GitHub account per project

The project menu picks which `gh` account a project uses; `gh` calls for that project run with its token. Settings › GitHub lists the logged-in accounts. (PR #29)

## Fork files
- `src-tauri/src/github_accounts.rs` — account pinned in the repo's local git config; `token_for`
- `src/features/inbox/hooks/useGithubAccountMenu.ts`
- `src/features/inbox/model/githubAccounts.ts`
- `src/features/inbox/ui/GithubAccountsList.tsx`

## Upstream hooks
- `src-tauri/src/fs.rs` — `GH_TOKEN` from `github_accounts::token_for` in `gh_run_raw`
- `src-tauri/src/lib.rs` — `mod github_accounts`, its three commands in the invoke handler
- `src/app/shell/useProjectMenu.tsx` — `useGithubAccountMenu`, `github-account:` action branch, `withGithubAccountItem` around `projectMenuExtraItems`
- `src/features/settings/ui/SettingsView.tsx` — `<GithubAccountsList>` in `GithubSettings`

## Verify
- `cargo test` (`github_accounts` parsing)
- Manual: with two `gh` accounts, pin one on a project; its Inbox items come from that account.
