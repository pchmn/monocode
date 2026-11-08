use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

use serde::Serialize;

const MAX_TAIL_BYTES: u64 = 512 * 1024;

#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LogTail {
    /// None when the file has not changed size since `since_size`.
    text: Option<String>,
    size: u64,
    truncated: bool,
    missing: bool,
}

/// The end of a log file a background command is still writing to.
#[tauri::command(async)]
pub fn read_log_tail(path: String, since_size: Option<u64>) -> Result<LogTail, String> {
    read_tail(Path::new(&path), since_size, MAX_TAIL_BYTES)
}

fn read_tail(path: &Path, since_size: Option<u64>, max_bytes: u64) -> Result<LogTail, String> {
    let Ok(mut file) = std::fs::File::open(path) else {
        return Ok(LogTail {
            text: None,
            size: 0,
            truncated: false,
            missing: true,
        });
    };
    let size = file.metadata().map_err(|e| e.to_string())?.len();
    if since_size == Some(size) {
        return Ok(LogTail {
            text: None,
            size,
            truncated: false,
            missing: false,
        });
    }
    let start = size.saturating_sub(max_bytes);
    file.seek(SeekFrom::Start(start))
        .map_err(|e| e.to_string())?;
    let mut bytes = Vec::new();
    file.take(max_bytes)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    let mut text = String::from_utf8_lossy(&bytes).into_owned();
    if start > 0 {
        // Drop the partial first line the cut landed in.
        if let Some(newline) = text.find('\n') {
            text.drain(..=newline);
        }
    }
    Ok(LogTail {
        text: Some(text),
        size,
        truncated: start > 0,
        missing: false,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_tail_and_skips_unchanged_files() {
        let dir = std::env::temp_dir().join(format!("log-tail-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("task.output");
        std::fs::write(&path, "one\ntwo\nthree\n").unwrap();

        let whole = read_tail(&path, None, 1024).unwrap();
        assert_eq!(whole.text.as_deref(), Some("one\ntwo\nthree\n"));
        assert!(!whole.truncated);

        let tail = read_tail(&path, None, 8).unwrap();
        assert_eq!(tail.text.as_deref(), Some("three\n"));
        assert!(tail.truncated);

        let same = read_tail(&path, Some(whole.size), 1024).unwrap();
        assert_eq!(same.text, None);

        std::fs::remove_dir_all(&dir).unwrap();
        assert!(read_tail(&path, None, 1024).unwrap().missing);
    }
}
