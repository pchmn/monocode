use std::path::Path;
use std::process::Command;

use crate::fs::{expand_home, git_cmd};

// Stored in the repo's local git config so every worktree of the project shares it.
const CONFIG_KEY: &str = "monocode.githubAccount";

fn gh(args: &[&str]) -> Result<String, String> {
    let program = crate::harness::resolve_gui_binary("gh")
        .ok_or_else(|| "GitHub CLI (`gh`) is not installed.".to_string())?;
    let mut cmd = Command::new(program);
    cmd.args(args)
        // An inherited token would shadow the keyring accounts we ask about.
        .env_remove("GH_TOKEN")
        .env_remove("GITHUB_TOKEN")
        .env("GH_PROMPT_DISABLED", "1")
        .env("GH_PAGER", "cat");
    crate::harness::apply_gui_env(&mut cmd);
    crate::hide_window_console(&mut cmd);
    let output = cmd.output().map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn valid_login(login: &str) -> bool {
    !login.is_empty()
        && !login.starts_with('-')
        && login.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

/// `None` when the project has no account pinned; `Err` when it is not a git repository.
fn project_account(root: &Path) -> Result<Option<String>, String> {
    let output = git_cmd()
        .arg("-C")
        .arg(root)
        .args(["config", "--local", "--get", CONFIG_KEY])
        .output()
        .map_err(|error| error.to_string())?;
    match output.status.code() {
        Some(0) => Ok(
            Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
                .filter(|login| valid_login(login)),
        ),
        Some(1) => Ok(None),
        _ => Err(String::from_utf8_lossy(&output.stderr).trim().to_string()),
    }
}

/// Token of the account pinned to `root`, to pass to `gh` as `GH_TOKEN`.
pub(crate) fn token_for(root: &Path) -> Result<Option<String>, String> {
    let Ok(Some(login)) = project_account(root) else {
        return Ok(None);
    };
    gh(&[
        "auth",
        "token",
        "--hostname",
        "github.com",
        "--user",
        &login,
    ])
    .map(Some)
    .map_err(|_| format!("GitHub account {login} is not signed in to gh. Run gh auth login."))
}

fn parse_accounts(json: &str) -> Result<Vec<String>, String> {
    let value: serde_json::Value = serde_json::from_str(json).map_err(|e| e.to_string())?;
    let mut logins: Vec<String> = value["hosts"]["github.com"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|account| account["state"] == "success")
        .filter_map(|account| account["login"].as_str().map(str::to_owned))
        .collect();
    logins.sort_by_key(|login| login.to_lowercase());
    logins.dedup();
    Ok(logins)
}

#[tauri::command(async)]
pub fn github_accounts() -> Result<Vec<String>, String> {
    parse_accounts(&gh(&[
        "auth",
        "status",
        "--hostname",
        "github.com",
        "--json",
        "hosts",
    ])?)
}

#[tauri::command(async)]
pub fn github_project_account(cwd: String) -> Result<Option<String>, String> {
    project_account(&expand_home(&cwd))
}

#[tauri::command(async)]
pub fn set_github_project_account(cwd: String, login: Option<String>) -> Result<(), String> {
    let root = expand_home(&cwd);
    let mut cmd = git_cmd();
    cmd.arg("-C").arg(&root).args(["config", "--local"]);
    match login.as_deref() {
        Some(login) if valid_login(login) => cmd.args([CONFIG_KEY, login]),
        Some(_) => return Err("Invalid GitHub login".into()),
        None => cmd.args(["--unset", CONFIG_KEY]),
    };
    let output = cmd.output().map_err(|error| error.to_string())?;
    // Exit 5: nothing to unset.
    if output.status.success() || (login.is_none() && output.status.code() == Some(5)) {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_signed_in_accounts_once_each() {
        let json = r#"{"hosts":{"github.com":[
            {"login":"pchmn","state":"success","active":true},
            {"login":"pchmn","state":"success","active":false},
            {"login":"work","state":"success","active":false},
            {"login":"stale","state":"error","active":false}
        ]}}"#;
        assert_eq!(parse_accounts(json).unwrap(), ["pchmn", "work"]);
    }

    #[test]
    fn rejects_logins_that_could_be_git_options() {
        assert!(valid_login("paul-chemin1"));
        assert!(!valid_login("--add"));
        assert!(!valid_login(""));
    }
}
