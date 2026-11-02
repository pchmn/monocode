use std::path::Path;

use serde::Serialize;

use crate::fs::expand_home;

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DefaultBranchStart {
    branch: String,
    /// Freshest ref to start a worktree from: `origin/<branch>` when it exists.
    base: String,
    on_default: bool,
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

fn operation_in_progress(dir: &Path) -> bool {
    [
        "MERGE_HEAD",
        "CHERRY_PICK_HEAD",
        "REVERT_HEAD",
        "rebase-merge",
        "rebase-apply",
        "BISECT_LOG",
    ]
    .iter()
    .any(|name| {
        git(dir, &["rev-parse", "--git-path", name]).is_some_and(|path| dir.join(path).exists())
    })
}

/// Switches a clean checkout to `branch` and fast-forwards it; anything else is left alone.
fn move_checkout(dir: &Path, branch: &str, base: &str) {
    let clean = git(dir, &["status", "--porcelain", "--untracked-files=no"])
        .is_some_and(|out| out.is_empty());
    if !clean || operation_in_progress(dir) {
        return;
    }
    let current = git(dir, &["symbolic-ref", "--quiet", "--short", "HEAD"]);
    if current.as_deref() != Some(branch) && git(dir, &["switch", "--quiet", branch]).is_none() {
        return;
    }
    if base != branch {
        let _ = git(dir, &["merge", "--ff-only", "--quiet", base]);
    }
}

fn start(dir: &Path, checkout: bool) -> Option<DefaultBranchStart> {
    let branch = default_branch(dir)?;
    let remote = format!("origin/{branch}");
    let base = if git(dir, &["rev-parse", "--verify", "--quiet", &remote]).is_some() {
        remote
    } else {
        branch.clone()
    };
    if checkout {
        move_checkout(dir, &branch, &base);
    }
    let on_default =
        git(dir, &["symbolic-ref", "--quiet", "--short", "HEAD"]).as_deref() == Some(&branch);
    Some(DefaultBranchStart {
        branch,
        base,
        on_default,
    })
}

#[tauri::command(async)]
pub fn default_branch_name(cwd: String) -> Option<String> {
    default_branch(&expand_home(&cwd))
}

/// Offline, the session still starts from the last fetched default branch.
#[tauri::command(async)]
pub fn default_branch_fetch(cwd: String) {
    let _ = git(
        &expand_home(&cwd),
        &["fetch", "--quiet", "--no-tags", "origin"],
    );
}

#[tauri::command(async)]
pub fn default_branch_start(cwd: String, checkout: bool) -> Option<DefaultBranchStart> {
    start(&expand_home(&cwd), checkout)
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
    fn clean_checkout_moves_to_the_latest_default_branch() {
        let (_dir, origin, clone) = setup();
        let started = start(&clone, true).unwrap();
        assert_eq!(started.branch, "main");
        assert_eq!(started.base, "origin/main");
        assert!(started.on_default);
        assert_eq!(head(&clone), head(&origin));
    }

    #[test]
    fn dirty_checkout_stays_on_its_branch() {
        let (_dir, _origin, clone) = setup();
        std::fs::write(clone.join("b.txt"), "edited").unwrap();
        let before = head(&clone);
        let started = start(&clone, true).unwrap();
        assert!(!started.on_default);
        assert_eq!(head(&clone), before);
    }

    #[test]
    fn worktree_start_leaves_the_checkout_alone() {
        let (_dir, _origin, clone) = setup();
        let before = head(&clone);
        let started = start(&clone, false).unwrap();
        assert_eq!(started.base, "origin/main");
        assert!(!started.on_default);
        assert_eq!(head(&clone), before);
    }

    #[test]
    fn diverged_default_branch_is_not_rewritten() {
        let (_dir, origin, clone) = setup();
        run(&clone, &["switch", "main"]);
        commit(&clone, "d.txt", "d");
        let local = head(&clone);
        let started = start(&clone, true).unwrap();
        assert!(started.on_default);
        assert_eq!(head(&clone), local);
        assert_ne!(head(&clone), head(&origin));
    }
}
