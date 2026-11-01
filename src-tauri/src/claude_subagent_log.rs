use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::AppHandle;

use crate::dirs_home;

#[derive(Serialize, Debug, PartialEq, Eq)]
pub struct ClaudeSubagentLogChunk {
    lines: Vec<String>,
    offset: u64,
}

/// New complete lines of a subagent's own transcript, which Claude writes to
/// disk but never streams for a backgrounded run.
#[tauri::command(async)]
pub fn claude_subagent_log(
    app: AppHandle,
    provider_session_id: String,
    provider_account_id: Option<String>,
    agent_id: String,
    offset: u64,
) -> Result<ClaudeSubagentLogChunk, String> {
    if !is_safe_id(&provider_session_id) || !is_safe_id(&agent_id) {
        return Err("Invalid Claude subagent id".into());
    }
    let config_dir = match provider_account_id.as_deref() {
        Some(id) if id != "default" => crate::harness::provider_account_path(&app, "claude", id)?,
        _ => match std::env::var_os("CLAUDE_CONFIG_DIR") {
            Some(path) => PathBuf::from(path),
            None => {
                PathBuf::from(dirs_home().ok_or("Home directory is unavailable")?).join(".claude")
            }
        },
    };
    let relative = Path::new(&provider_session_id)
        .join("subagents")
        .join(format!("agent-{agent_id}.jsonl"));
    let Some(path) = std::fs::read_dir(config_dir.join("projects"))
        .ok()
        .and_then(|projects| {
            projects.flatten().find_map(|project| {
                let candidate = project.path().join(&relative);
                candidate.is_file().then_some(candidate)
            })
        })
    else {
        return Ok(ClaudeSubagentLogChunk {
            lines: Vec::new(),
            offset,
        });
    };
    read_complete_lines(&path, offset)
}

fn is_safe_id(id: &str) -> bool {
    !id.is_empty()
        && id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
}

fn read_complete_lines(path: &Path, offset: u64) -> Result<ClaudeSubagentLogChunk, String> {
    let mut file = std::fs::File::open(path).map_err(|error| error.to_string())?;
    file.seek(SeekFrom::Start(offset))
        .map_err(|error| error.to_string())?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)
        .map_err(|error| error.to_string())?;
    // A line still being written stays for the next read.
    let Some(end) = bytes.iter().rposition(|&byte| byte == b'\n') else {
        return Ok(ClaudeSubagentLogChunk {
            lines: Vec::new(),
            offset,
        });
    };
    let lines = String::from_utf8_lossy(&bytes[..end])
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(str::to_owned)
        .collect();
    Ok(ClaudeSubagentLogChunk {
        lines,
        offset: offset + end as u64 + 1,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_only_complete_lines_from_offset() {
        let dir = std::env::temp_dir().join(format!("claude-subagent-log-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("agent.jsonl");
        std::fs::write(&path, "{\"a\":1}\n{\"b\":2}\n{\"c\"").unwrap();

        let first = read_complete_lines(&path, 0).unwrap();
        assert_eq!(first.lines, vec!["{\"a\":1}", "{\"b\":2}"]);
        assert_eq!(first.offset, 16);

        std::fs::write(&path, "{\"a\":1}\n{\"b\":2}\n{\"c\":3}\n").unwrap();
        let second = read_complete_lines(&path, first.offset).unwrap();
        assert_eq!(second.lines, vec!["{\"c\":3}"]);
        assert_eq!(second.offset, 24);

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn rejects_path_like_ids() {
        assert!(!is_safe_id("../x"));
        assert!(!is_safe_id(""));
        assert!(is_safe_id("af3947e2c9b320318"));
    }
}
