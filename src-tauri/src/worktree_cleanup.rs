use std::io::Write;
use std::path::Path;
use std::process::Stdio;

use serde::Serialize;

use crate::fs::expand_home;

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorktreeCleanupStatus {
    path: String,
    clean: bool,
    /// Everything on the branch is already in the default branch, squash merges included.
    integrated: bool,
    has_commits: bool,
}

fn git(dir: &Path, args: &[&str]) -> Option<String> {
    let output = crate::fs::git_cmd()
        .arg("-C")
        .arg(dir)
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_OPTIONAL_LOCKS", "0")
        .output()
        .ok()?;
    output
        .status
        .success()
        .then(|| String::from_utf8_lossy(&output.stdout).trim().to_owned())
}

fn patch_ids(dir: &Path, input: &[u8]) -> Option<Vec<(String, String)>> {
    let mut child = crate::fs::git_cmd()
        .arg("-C")
        .arg(dir)
        .args(["patch-id", "--stable"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .ok()?;
    let mut stdin = child.stdin.take()?;
    let input = input.to_vec();
    let writer = std::thread::spawn(move || stdin.write_all(&input));
    let output = child.wait_with_output().ok()?;
    writer.join().ok()?.ok()?;
    output.status.success().then(|| {
        String::from_utf8_lossy(&output.stdout)
            .lines()
            .filter_map(|line| line.split_once(' '))
            .map(|(id, commit)| (id.to_owned(), commit.to_owned()))
            .collect()
    })
}

/// A commit of `target` carries the branch's whole diff: a squash merge, even when later commits touched its lines.
fn squash_merged(dir: &Path, base: &str, target: &str) -> bool {
    let branch_id = git(dir, &["diff", "--no-color", "--no-ext-diff", base, "HEAD"])
        .and_then(|diff| patch_ids(dir, format!("{diff}\n").as_bytes()))
        .and_then(|ids| ids.into_iter().next())
        .map(|(id, _)| id);
    let Some(branch_id) = branch_id else {
        return false;
    };
    let range = format!("{base}..{target}");
    git(
        dir,
        &[
            "log",
            "-p",
            "--no-color",
            "--no-ext-diff",
            "--no-merges",
            &range,
        ],
    )
    .and_then(|log| patch_ids(dir, format!("{log}\n").as_bytes()))
    .is_some_and(|ids| ids.iter().any(|(id, _)| *id == branch_id))
}

fn default_branch(dir: &Path) -> Option<String> {
    git(dir, &["rev-parse", "--abbrev-ref", "origin/HEAD"])
        .filter(|name| !name.is_empty() && name != "origin/HEAD")
        .or_else(|| {
            git(dir, &["rev-parse", "--verify", "--quiet", "origin/main"])
                .map(|_| "origin/main".to_owned())
        })
}

fn status(dir: &Path, target: Option<&str>) -> WorktreeCleanupStatus {
    let clean = git(dir, &["status", "--porcelain", "--untracked-files=normal"])
        .is_some_and(|out| out.is_empty());
    let (integrated, has_commits) = target
        .and_then(|target| {
            let head = git(dir, &["rev-parse", "HEAD"])?;
            let base = git(dir, &["merge-base", "HEAD", target])?;
            // A clean merge whose result is the target's own tree adds nothing to it.
            // Conflicts make merge-tree fail: that must not reset `has_commits` too.
            let merged =
                git(dir, &["merge-tree", "--write-tree", target, "HEAD"]).unwrap_or_default();
            let target_tree = git(dir, &["rev-parse", &format!("{target}^{{tree}}")])?;
            let has_commits = head != base;
            let integrated = merged.lines().next() == Some(&target_tree)
                || (has_commits && squash_merged(dir, &base, target));
            Some((integrated, has_commits))
        })
        .unwrap_or((false, false));
    WorktreeCleanupStatus {
        path: dir.to_string_lossy().into_owned(),
        clean,
        integrated,
        has_commits,
    }
}

#[tauri::command(async)]
pub fn worktree_cleanup_status(cwd: String, paths: Vec<String>) -> Vec<WorktreeCleanupStatus> {
    let root = expand_home(&cwd);
    // Offline, a stale default branch only makes branches look unmerged.
    let _ = git(&root, &["fetch", "--quiet", "--no-tags", "origin"]);
    let target = default_branch(&root);
    paths
        .iter()
        .map(|path| status(&expand_home(path), target.as_deref()))
        .collect()
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

    /// A repo whose `origin/main` is its own `main`, plus a worktree on `feat`.
    fn setup() -> (Dir, PathBuf, PathBuf) {
        let dir = std::env::temp_dir().join(format!("monocode-cleanup-{}", uuid::Uuid::new_v4()));
        let root = dir.join("repo");
        std::fs::create_dir_all(&root).unwrap();
        run(&root, &["init", "-b", "main"]);
        commit(&root, "a.txt", "a\n");
        run(&root, &["update-ref", "refs/remotes/origin/main", "main"]);
        let tree = dir.join("feat");
        run(
            &root,
            &["worktree", "add", "-b", "feat", tree.to_str().unwrap()],
        );
        (Dir(dir), root, tree)
    }

    fn sync_origin(root: &Path) {
        run(root, &["update-ref", "refs/remotes/origin/main", "main"]);
    }

    #[test]
    fn fresh_worktree_is_integrated_without_commits() {
        let (_dir, _root, tree) = setup();
        let got = status(&tree, Some("origin/main"));
        assert!(got.clean && got.integrated && !got.has_commits);
    }

    #[test]
    fn unmerged_commit_is_not_integrated() {
        let (_dir, _root, tree) = setup();
        commit(&tree, "b.txt", "b\n");
        let got = status(&tree, Some("origin/main"));
        assert!(got.clean && !got.integrated && got.has_commits);
    }

    #[test]
    fn squash_merged_branch_is_integrated() {
        let (_dir, root, tree) = setup();
        commit(&tree, "b.txt", "b\n");
        commit(&tree, "c.txt", "c\n");
        run(&root, &["merge", "--squash", "feat"]);
        run(&root, &["commit", "-m", "squash"]);
        commit(&root, "d.txt", "d\n");
        sync_origin(&root);
        let got = status(&tree, Some("origin/main"));
        assert!(got.clean && got.integrated && got.has_commits);
    }

    #[test]
    fn squash_merged_branch_is_integrated_after_main_edits_its_lines() {
        let (_dir, root, tree) = setup();
        commit(&tree, "b.txt", "b\n");
        run(&root, &["merge", "--squash", "feat"]);
        run(&root, &["commit", "-m", "squash"]);
        commit(&root, "b.txt", "b2\n");
        sync_origin(&root);
        let got = status(&tree, Some("origin/main"));
        assert!(got.clean && got.integrated && got.has_commits);
    }

    #[test]
    fn conflicting_unmerged_branch_is_not_integrated() {
        let (_dir, root, tree) = setup();
        commit(&tree, "a.txt", "feat\n");
        commit(&root, "a.txt", "main\n");
        sync_origin(&root);
        let got = status(&tree, Some("origin/main"));
        assert!(!got.integrated && got.has_commits);
    }

    #[test]
    fn uncommitted_changes_are_not_clean() {
        let (_dir, _root, tree) = setup();
        std::fs::write(tree.join("new.txt"), "x").unwrap();
        assert!(!status(&tree, Some("origin/main")).clean);
    }

    #[test]
    fn no_default_branch_is_never_integrated() {
        let (_dir, _root, tree) = setup();
        assert!(!status(&tree, None).integrated);
    }
}
