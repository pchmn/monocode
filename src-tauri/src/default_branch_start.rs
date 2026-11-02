use std::path::Path;
use std::process::Stdio;
use std::time::{Duration, Instant};

use serde::Serialize;

use crate::fs::expand_home;

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DefaultBranchStart {
    branch: String,
    /// Freshest ref to start a worktree from: `origin/<branch>` when it exists.
    base: String,
}

fn git(dir: &Path, args: &[&str]) -> Option<String> {
    let output = crate::fs::git_cmd()
        .arg("-C")
        .arg(dir)
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .output()
        .ok()?;
    output
        .status
        .success()
        .then(|| String::from_utf8_lossy(&output.stdout).trim().to_owned())
}

fn default_branch(dir: &Path) -> Option<String> {
    git(
        dir,
        &["symbolic-ref", "--short", "refs/remotes/origin/HEAD"],
    )
    .and_then(|head| head.strip_prefix("origin/").map(str::to_owned))
    .or_else(|| {
        ["main", "master"]
            .into_iter()
            .map(str::to_owned)
            .find(|name| {
                git(
                    dir,
                    &[
                        "show-ref",
                        "--verify",
                        "--quiet",
                        &format!("refs/remotes/origin/{name}"),
                    ],
                )
                .is_some()
            })
    })
}

fn start(dir: &Path) -> Option<DefaultBranchStart> {
    let branch = default_branch(dir)?;
    let remote = format!("origin/{branch}");
    let base = if git(dir, &["rev-parse", "--verify", "--quiet", &remote]).is_some() {
        remote
    } else {
        branch.clone()
    };
    Some(DefaultBranchStart { branch, base })
}

/// Commits the current branch lacks from its upstream, 0 unless a fast-forward can apply them.
fn behind_upstream(dir: &Path) -> u32 {
    git(
        dir,
        &["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
    )
    .and_then(|counts| {
        let (ahead, behind) = counts.split_once('\t')?;
        (ahead == "0").then(|| behind.parse().ok()).flatten()
    })
    .unwrap_or(0)
}

const FETCH_TIMEOUT: Duration = Duration::from_secs(10);

/// A stalled network or credential prompt must not hold the session start.
fn fetch_origin(dir: &Path) {
    let Ok(mut child) = crate::fs::git_cmd()
        .arg("-C")
        .arg(dir)
        .args(["fetch", "--quiet", "--no-tags", "origin"])
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
    else {
        return;
    };
    let deadline = Instant::now() + FETCH_TIMEOUT;
    while Instant::now() < deadline {
        if !matches!(child.try_wait(), Ok(None)) {
            return;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    let _ = child.kill();
    let _ = child.wait();
}

#[tauri::command(async)]
pub fn default_branch_name(cwd: String) -> Option<String> {
    default_branch(&expand_home(&cwd))
}

/// Offline, the session still starts from the last fetched default branch.
#[tauri::command(async)]
pub fn default_branch_fetch(cwd: String) {
    fetch_origin(&expand_home(&cwd));
}

#[tauri::command(async)]
pub fn default_branch_start(cwd: String) -> Option<DefaultBranchStart> {
    start(&expand_home(&cwd))
}

#[tauri::command(async)]
pub fn branch_behind_upstream(cwd: String) -> u32 {
    behind_upstream(&expand_home(&cwd))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    struct Dir(PathBuf);
    impl Drop for Dir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn run(dir: &Path, args: &[&str]) {
        let ok = std::process::Command::new("git")
            .arg("-C")
            .arg(dir)
            .args(["-c", "user.name=Test", "-c", "user.email=test@example.com"])
            .args(args)
            .output()
            .unwrap()
            .status
            .success();
        assert!(ok, "git {args:?}");
    }

    fn commit(dir: &Path, file: &str, text: &str) {
        std::fs::write(dir.join(file), text).unwrap();
        run(dir, &["add", file]);
        run(dir, &["commit", "-m", file]);
    }

    fn head(dir: &Path) -> String {
        git(dir, &["rev-parse", "HEAD"]).unwrap()
    }

    /// A clone on a `feat` branch whose origin's `main` moved one commit ahead.
    fn setup() -> (Dir, PathBuf, PathBuf) {
        let dir =
            std::env::temp_dir().join(format!("monocode-default-start-{}", uuid::Uuid::new_v4()));
        let origin = dir.join("origin");
        std::fs::create_dir_all(&origin).unwrap();
        run(&origin, &["init", "-b", "main"]);
        commit(&origin, "a.txt", "a");
        let clone = dir.join("clone");
        run(
            &dir,
            &[
                "clone",
                "--quiet",
                origin.to_str().unwrap(),
                clone.to_str().unwrap(),
            ],
        );
        run(&clone, &["switch", "-c", "feat"]);
        commit(&clone, "b.txt", "b");
        commit(&origin, "c.txt", "c");
        run(&clone, &["fetch", "--quiet", "origin"]);
        (Dir(dir), origin, clone)
    }

    #[test]
    fn start_prefers_the_fetched_default_branch() {
        let (_dir, _origin, clone) = setup();
        let before = head(&clone);
        let started = start(&clone).unwrap();
        assert_eq!(started.branch, "main");
        assert_eq!(started.base, "origin/main");
        assert_eq!(head(&clone), before);
    }

    #[test]
    fn behind_counts_only_fast_forwardable_commits() {
        let (_dir, _origin, clone) = setup();
        run(&clone, &["switch", "main"]);
        assert_eq!(behind_upstream(&clone), 1);
        commit(&clone, "d.txt", "d");
        assert_eq!(behind_upstream(&clone), 0);
    }

    #[test]
    fn branch_without_upstream_is_never_behind() {
        let (_dir, _origin, clone) = setup();
        assert_eq!(behind_upstream(&clone), 0);
    }
}
