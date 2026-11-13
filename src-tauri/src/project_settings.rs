use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

const SETTINGS_DIR: &str = ".monocode";
const SETTINGS_FILE: &str = "settings.json";
const COMMAND_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_ERROR_CHARS: usize = 2_000;

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct ProjectSettings {
    #[serde(default)]
    on_save: Vec<OnSaveRule>,
}

#[derive(Deserialize)]
struct OnSaveRule {
    files: Globs,
    command: String,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum Globs {
    One(String),
    Many(Vec<String>),
}

impl Globs {
    fn as_slice(&self) -> &[String] {
        match self {
            Globs::One(glob) => std::slice::from_ref(glob),
            Globs::Many(globs) => globs,
        }
    }
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SaveCommand {
    settings_path: String,
    /// Changes whenever the settings file does, so a trust grant covers one exact version.
    settings_hash: String,
    root: String,
    commands: Vec<String>,
    command: String,
}

#[tauri::command]
pub async fn project_save_command(path: String) -> Result<Option<SaveCommand>, String> {
    tauri::async_runtime::spawn_blocking(move || save_command_for(Path::new(&path)))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn project_run_save_command(root: String, command: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || run_command(Path::new(&root), &command))
        .await
        .map_err(|error| error.to_string())?
}

fn save_command_for(file: &Path) -> Result<Option<SaveCommand>, String> {
    let Some(settings_path) = find_settings(file) else {
        return Ok(None);
    };
    let raw = std::fs::read_to_string(&settings_path)
        .map_err(|error| format!("{}: {error}", settings_path.display()))?;
    let settings =
        parse_settings(&raw).map_err(|error| format!("{}: {error}", settings_path.display()))?;
    let root = settings_path
        .parent()
        .and_then(Path::parent)
        .ok_or("settings file has no project root")?;
    let Ok(relative) = file.strip_prefix(root) else {
        return Ok(None);
    };
    let relative = relative.to_string_lossy().replace('\\', "/");
    let Some(rule) = settings.on_save.iter().find(|rule| {
        rule.files
            .as_slice()
            .iter()
            .any(|glob| glob_matches(glob, &relative))
    }) else {
        return Ok(None);
    };
    Ok(Some(SaveCommand {
        settings_path: settings_path.to_string_lossy().into_owned(),
        settings_hash: sha256_hex(raw.as_bytes()),
        root: root.to_string_lossy().into_owned(),
        commands: settings
            .on_save
            .iter()
            .map(|rule| rule.command.clone())
            .collect(),
        command: expand_command(&rule.command, &file.to_string_lossy(), &relative),
    }))
}

fn parse_settings(raw: &str) -> Result<ProjectSettings, String> {
    let json = crate::jsonc::strip_jsonc_comments(raw).ok_or("unterminated comment")?;
    if json.trim().is_empty() {
        return Ok(ProjectSettings::default());
    }
    serde_json::from_str(&json).map_err(|error| error.to_string())
}

/// Nearest `.monocode/settings.json` above `file`, never looking past its git root.
fn find_settings(file: &Path) -> Option<PathBuf> {
    for dir in file.ancestors().skip(1) {
        let candidate = dir.join(SETTINGS_DIR).join(SETTINGS_FILE);
        if candidate.is_file() {
            return Some(candidate);
        }
        if dir.join(".git").exists() {
            return None;
        }
    }
    None
}

fn expand_command(template: &str, file: &str, relative: &str) -> String {
    template
        .replace("${relativeFile}", &shell_quote(relative))
        .replace("${file}", &shell_quote(file))
}

#[cfg(not(windows))]
fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', r"'\''"))
}

#[cfg(windows)]
fn shell_quote(value: &str) -> String {
    format!("\"{value}\"")
}

fn run_command(root: &Path, command: &str) -> Result<(), String> {
    #[cfg(not(windows))]
    let mut cmd = {
        let mut cmd = Command::new("/bin/sh");
        cmd.args(["-c", command]);
        cmd
    };
    #[cfg(windows)]
    let mut cmd = {
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", command]);
        cmd
    };
    cmd.current_dir(root)
        .env("PATH", crate::harness::gui_search_path())
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    crate::hide_window_console(&mut cmd);
    let mut child = cmd.spawn().map_err(|error| format!("{command}: {error}"))?;
    let stdout = drain(child.stdout.take());
    let stderr = drain(child.stderr.take());

    let started = Instant::now();
    let status = loop {
        if let Some(status) = child.try_wait().map_err(|error| error.to_string())? {
            break status;
        }
        if started.elapsed() > COMMAND_TIMEOUT {
            let _ = child.kill();
            let _ = child.wait();
            return Err(format!(
                "`{command}` timed out after {}s",
                COMMAND_TIMEOUT.as_secs()
            ));
        }
        std::thread::sleep(Duration::from_millis(20));
    };
    if status.success() {
        return Ok(());
    }
    let stderr = stderr.join().unwrap_or_default();
    let output = if stderr.trim().is_empty() {
        stdout.join().unwrap_or_default()
    } else {
        stderr
    };
    let output: String = output.trim().chars().take(MAX_ERROR_CHARS).collect();
    let code = status
        .code()
        .map_or("a signal".to_string(), |code| code.to_string());
    Err(format!("`{command}` exited with {code}: {output}"))
}

fn drain<R: Read + Send + 'static>(pipe: Option<R>) -> std::thread::JoinHandle<String> {
    std::thread::spawn(move || {
        let mut out = Vec::new();
        if let Some(mut pipe) = pipe {
            let _ = pipe.read_to_end(&mut out);
        }
        String::from_utf8_lossy(&out).into_owned()
    })
}

fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// `*`, `?`, `**` and `{a,b}` globs. A pattern without `/` matches the basename at any depth.
fn glob_matches(pattern: &str, relative: &str) -> bool {
    expand_braces(pattern).iter().any(|pattern| {
        let pattern = pattern.trim_start_matches("./");
        if pattern.contains('/') {
            match_segments(&split(pattern), &split(relative))
        } else {
            let name = relative.rsplit('/').next().unwrap_or(relative);
            match_segment(pattern.as_bytes(), name.as_bytes())
        }
    })
}

fn split(path: &str) -> Vec<&str> {
    path.split('/').filter(|part| !part.is_empty()).collect()
}

fn expand_braces(pattern: &str) -> Vec<String> {
    let Some(open) = pattern.find('{') else {
        return vec![pattern.to_string()];
    };
    let Some(close) = pattern[open..].find('}').map(|offset| open + offset) else {
        return vec![pattern.to_string()];
    };
    let (head, tail) = (&pattern[..open], &pattern[close + 1..]);
    pattern[open + 1..close]
        .split(',')
        .flat_map(|choice| expand_braces(&format!("{head}{choice}{tail}")))
        .collect()
}

fn match_segments(pattern: &[&str], path: &[&str]) -> bool {
    match pattern.split_first() {
        None => path.is_empty(),
        Some((&"**", rest)) => (0..=path.len()).any(|skip| match_segments(rest, &path[skip..])),
        Some((first, rest)) => match path.split_first() {
            Some((segment, path_rest)) => {
                match_segment(first.as_bytes(), segment.as_bytes())
                    && match_segments(rest, path_rest)
            }
            None => false,
        },
    }
}

fn match_segment(pattern: &[u8], name: &[u8]) -> bool {
    match pattern.split_first() {
        None => name.is_empty(),
        Some((b'*', rest)) => (0..=name.len()).any(|skip| match_segment(rest, &name[skip..])),
        Some((b'?', rest)) => !name.is_empty() && match_segment(rest, &name[1..]),
        Some((byte, rest)) => name.first() == Some(byte) && match_segment(rest, &name[1..]),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_project(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "monocode-project-settings-{name}-{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join(".git")).unwrap();
        std::fs::create_dir_all(dir.join(".monocode")).unwrap();
        std::fs::create_dir_all(dir.join("src/deep")).unwrap();
        dir
    }

    #[test]
    fn globs_match_like_editor_settings() {
        assert!(glob_matches("*.rs", "src/deep/main.rs"));
        assert!(glob_matches("**/*.rs", "main.rs"));
        assert!(glob_matches("src/**/*.{ts,tsx}", "src/a/b/App.tsx"));
        assert!(glob_matches("src/*.ts", "src/index.ts"));
        assert!(!glob_matches("src/*.ts", "src/a/index.ts"));
        assert!(!glob_matches("src/**/*.ts", "lib/index.ts"));
        assert!(glob_matches("./Cargo.tom?", "Cargo.toml"));
    }

    #[test]
    fn first_matching_rule_wins_and_paths_are_quoted() {
        let root = temp_project("match");
        std::fs::write(
            root.join(".monocode/settings.json"),
            r#"{
              // formatters
              "onSave": [
                { "files": ["*.md"], "command": "echo md" },
                { "files": "src/**/*.rs", "command": "rustfmt ${file} # ${relativeFile}" },
                { "files": "*.rs", "command": "never" }
              ]
            }"#,
        )
        .unwrap();
        let file = root.join("src/deep/it's.rs");
        let found = save_command_for(&file).unwrap().unwrap();
        assert_eq!(found.commands.len(), 3);
        assert!(found.command.starts_with("rustfmt '"));
        assert_eq!(found.root, root.to_string_lossy());
        assert!(found.command.ends_with(r"# 'src/deep/it'\''s.rs'"));
        assert!(save_command_for(&root.join("src/deep/x.ts"))
            .unwrap()
            .is_none());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn lookup_stops_at_the_git_root() {
        let root = temp_project("git-root");
        std::fs::remove_dir_all(root.join(".monocode")).unwrap();
        std::fs::create_dir_all(root.join("src/.git")).unwrap();
        std::fs::create_dir_all(root.join("src/.monocode")).unwrap();
        std::fs::write(root.join("src/.monocode/settings.json"), "{}").unwrap();
        assert_eq!(
            find_settings(&root.join("src/deep/a.rs")),
            Some(root.join("src/.monocode/settings.json"))
        );
        assert_eq!(find_settings(&root.join("a.rs")), None);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[cfg(not(windows))]
    #[test]
    fn failing_command_reports_stderr() {
        let root = temp_project("run");
        run_command(&root, "printf done > out.txt").unwrap();
        assert_eq!(
            std::fs::read_to_string(root.join("out.txt")).unwrap(),
            "done"
        );
        let error = run_command(&root, "echo boom >&2; exit 3").unwrap_err();
        assert!(error.contains("exited with 3: boom"), "{error}");
        std::fs::remove_dir_all(root).unwrap();
    }
}
