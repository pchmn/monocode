use serde::Serialize;
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, Once, OnceLock};
use std::time::{Duration, Instant};
use tauri::ipc::Channel;

// Kept briefly after its last file closes, so reopening one stays instant.
const CLOSED_GRACE: Duration = Duration::from_secs(2 * 60);
const IDLE_TIMEOUT: Duration = Duration::from_secs(15 * 60);
const REAP_INTERVAL: Duration = Duration::from_secs(30);
// Each worktree is its own repository root, hence its own server.
const MAX_SERVERS: usize = 2;

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LspDocument {
    root: String,
    root_uri: String,
    uri: String,
    language_id: &'static str,
}

/// The server a file belongs to, or `None` when no server handles it.
#[tauri::command]
pub async fn lsp_document(path: String) -> Result<Option<LspDocument>, String> {
    tauri::async_runtime::spawn_blocking(move || document(Path::new(&path)))
        .await
        .map_err(|error| error.to_string())?
}

fn document(file: &Path) -> Result<Option<LspDocument>, String> {
    let Some(language_id) = language_id(file) else {
        return Ok(None);
    };
    let root = project_root(file);
    Ok(Some(LspDocument {
        root_uri: file_uri(&root)?,
        root: root.to_string_lossy().into_owned(),
        uri: file_uri(file)?,
        language_id,
    }))
}

/// Starts a fresh server for `root`, replacing any running one: the webview
/// sends `initialize` itself, so a reloaded webview needs a new process.
/// `channel` receives each server message, then `None` once the process exits.
#[tauri::command]
pub async fn lsp_connect(
    root: String,
    path: String,
    channel: Channel<Option<String>>,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        connect(Path::new(&root), Path::new(&path), channel)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn lsp_send(root: String, messages: Vec<String>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || send(Path::new(&root), &messages))
        .await
        .map_err(|error| error.to_string())?
}

fn send(root: &Path, messages: &[String]) -> Result<(), String> {
    let server = servers()
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .get(root)
        .filter(|server| server.alive.load(Ordering::SeqCst))
        .cloned()
        .ok_or("tsgo is not running")?;
    server.touch();
    for message in messages {
        server.track(message);
        write_message(&server.stdin, message)?;
    }
    Ok(())
}

fn should_stop(open_documents: usize, idle: Duration) -> bool {
    (open_documents == 0 && idle >= CLOSED_GRACE) || idle >= IDLE_TIMEOUT
}

fn language_id(path: &Path) -> Option<&'static str> {
    match path.extension()?.to_str()? {
        "ts" | "mts" | "cts" => Some("typescript"),
        "tsx" => Some("typescriptreact"),
        "js" | "mjs" | "cjs" => Some("javascript"),
        "jsx" => Some("javascriptreact"),
        _ => None,
    }
}

/// One server per repository, so a monorepo's packages share one process.
fn project_root(file: &Path) -> PathBuf {
    let dir = file.parent().unwrap_or(file);
    dir.ancestors()
        .find(|ancestor| ancestor.join(".git").exists())
        .or_else(|| {
            dir.ancestors()
                .find(|ancestor| ancestor.join("tsconfig.json").is_file())
        })
        .unwrap_or(dir)
        .to_path_buf()
}

fn native_platform() -> String {
    let os = match std::env::consts::OS {
        "macos" => "darwin",
        "windows" => "win32",
        other => other,
    };
    let arch = match std::env::consts::ARCH {
        "aarch64" => "arm64",
        "x86_64" => "x64",
        other => other,
    };
    format!("{os}-{arch}")
}

/// The project's own TypeScript 7 or native preview first, then a global `tsgo`.
fn resolve_tsgo(file: &Path, root: &Path) -> Option<PathBuf> {
    let platform = native_platform();
    let exe = if cfg!(windows) { ".exe" } else { "" };
    let dir = file.parent().unwrap_or(file);
    for ancestor in dir.ancestors() {
        let packages = ancestor.join("node_modules").join("@typescript");
        for candidate in [
            packages
                .join(format!("native-preview-{platform}"))
                .join("lib")
                .join(format!("tsgo{exe}")),
            packages
                .join(format!("typescript-{platform}"))
                .join("lib")
                .join(format!("tsc{exe}")),
        ] {
            if candidate.is_file() {
                return Some(candidate);
            }
        }
        if ancestor == root {
            break;
        }
    }
    crate::harness::resolve_gui_binary("tsgo")
}

fn file_uri(path: &Path) -> Result<String, String> {
    url::Url::from_file_path(path)
        .map(|url| url.to_string())
        .map_err(|()| format!("{}: not an absolute path", path.display()))
}

struct Server {
    stdin: Arc<Mutex<ChildStdin>>,
    child: Mutex<Child>,
    alive: Arc<AtomicBool>,
    open_documents: Mutex<HashSet<String>>,
    last_used: Mutex<Instant>,
}

fn servers() -> &'static Mutex<HashMap<PathBuf, Arc<Server>>> {
    static SERVERS: OnceLock<Mutex<HashMap<PathBuf, Arc<Server>>>> = OnceLock::new();
    SERVERS.get_or_init(Default::default)
}

fn start_reaper() {
    static REAPER: Once = Once::new();
    REAPER.call_once(|| {
        std::thread::spawn(|| loop {
            std::thread::sleep(REAP_INTERVAL);
            // Dropping the last handle kills the process.
            servers()
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .retain(|_, server| server.alive.load(Ordering::SeqCst) && !server.idle_out());
        });
    });
}

fn connect(root: &Path, file: &Path, channel: Channel<Option<String>>) -> Result<(), String> {
    start_reaper();
    let mut servers = servers().lock().unwrap_or_else(|e| e.into_inner());
    servers.remove(root);
    while servers.len() >= MAX_SERVERS {
        let Some(oldest) = servers
            .iter()
            .min_by_key(|(_, server)| server.last_used())
            .map(|(root, _)| root.clone())
        else {
            break;
        };
        servers.remove(&oldest);
    }
    let binary = resolve_tsgo(file, root).ok_or_else(|| {
        "tsgo not found: install TypeScript 7 in the project or `npm i -g @typescript/native-preview`"
            .to_string()
    })?;
    let server = Server::spawn(&binary, root, channel)?;
    servers.insert(root.to_path_buf(), Arc::new(server));
    Ok(())
}

impl Server {
    fn spawn(binary: &Path, root: &Path, channel: Channel<Option<String>>) -> Result<Self, String> {
        let mut command = Command::new(binary);
        command
            .args(["--lsp", "--stdio"])
            .current_dir(root)
            // A global `tsgo` is a node launcher script that needs node on PATH.
            .env("PATH", crate::harness::gui_search_path())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
        }
        let mut child = command
            .spawn()
            .map_err(|error| format!("{}: {error}", binary.display()))?;
        let stdin = Arc::new(Mutex::new(child.stdin.take().ok_or("tsgo: no stdin")?));
        let stdout = child.stdout.take().ok_or("tsgo: no stdout")?;
        let alive = Arc::new(AtomicBool::new(true));
        {
            let stdin = stdin.clone();
            let alive = alive.clone();
            std::thread::spawn(move || {
                relay_messages(BufReader::new(stdout), &stdin, &channel);
                alive.store(false, Ordering::SeqCst);
                let _ = channel.send(None);
            });
        }
        Ok(Server {
            stdin,
            child: Mutex::new(child),
            alive,
            open_documents: Default::default(),
            last_used: Mutex::new(Instant::now()),
        })
    }

    /// Follows open documents for the stop policy.
    fn track(&self, message: &str) {
        let Ok(message) = serde_json::from_str::<Value>(message) else {
            return;
        };
        let uri = message
            .pointer("/params/textDocument/uri")
            .and_then(Value::as_str);
        let mut open = self
            .open_documents
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        match (message.get("method").and_then(Value::as_str), uri) {
            (Some("textDocument/didOpen"), Some(uri)) => {
                open.insert(uri.to_string());
            }
            (Some("textDocument/didClose"), Some(uri)) => {
                open.remove(uri);
            }
            _ => {}
        }
    }

    fn touch(&self) {
        *self.last_used.lock().unwrap_or_else(|e| e.into_inner()) = Instant::now();
    }

    fn last_used(&self) -> Instant {
        *self.last_used.lock().unwrap_or_else(|e| e.into_inner())
    }

    fn idle_out(&self) -> bool {
        let open = self
            .open_documents
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .len();
        should_stop(open, self.last_used().elapsed())
    }
}

impl Drop for Server {
    fn drop(&mut self) {
        let _ = self.child.lock().unwrap_or_else(|e| e.into_inner()).kill();
    }
}

fn write_message(stdin: &Mutex<ChildStdin>, body: &str) -> Result<(), String> {
    let mut stdin = stdin.lock().unwrap_or_else(|e| e.into_inner());
    write!(stdin, "Content-Length: {}\r\n\r\n{body}", body.len())
        .and_then(|()| stdin.flush())
        .map_err(|error| format!("tsgo: {error}"))
}

fn read_message(reader: &mut impl BufRead) -> Option<Value> {
    let mut length = None;
    loop {
        let mut header = String::new();
        if reader.read_line(&mut header).ok()? == 0 {
            return None;
        }
        let header = header.trim_end();
        if header.is_empty() {
            break;
        }
        if let Some((name, value)) = header.split_once(':') {
            if name.eq_ignore_ascii_case("content-length") {
                length = value.trim().parse::<usize>().ok();
            }
        }
    }
    let mut body = vec![0; length?];
    reader.read_exact(&mut body).ok()?;
    serde_json::from_slice(&body).ok()
}

fn relay_messages(
    mut reader: impl BufRead,
    stdin: &Mutex<ChildStdin>,
    channel: &Channel<Option<String>>,
) {
    while let Some(message) = read_message(&mut reader) {
        match (message.get("method"), message.get("id")) {
            // Answered here: the editor client rejects server requests, and
            // tsgo may stall on an error to `workspace/configuration`.
            (Some(method), Some(id)) => {
                let result = server_request_result(method.as_str().unwrap_or(""), &message);
                let response = json!({ "jsonrpc": "2.0", "id": id, "result": result });
                let _ = write_message(stdin, &response.to_string());
            }
            _ if is_verbose_log(&message) => {}
            _ => {
                if channel.send(Some(message.to_string())).is_err() {
                    return;
                }
            }
        }
    }
}

// The editor client only prints errors and warnings; tsgo logs on every request.
fn is_verbose_log(message: &Value) -> bool {
    message.get("method").and_then(Value::as_str) == Some("window/logMessage")
        && message.pointer("/params/type").and_then(Value::as_u64) > Some(2)
}

fn server_request_result(method: &str, message: &Value) -> Value {
    if method == "workspace/configuration" {
        let count = message
            .pointer("/params/items")
            .and_then(Value::as_array)
            .map_or(0, Vec::len);
        return Value::Array(vec![Value::Null; count]);
    }
    Value::Null
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_framed_messages() {
        let body = r#"{"jsonrpc":"2.0","id":1,"result":null}"#;
        let framed = format!("Content-Length: {}\r\n\r\n{body}", body.len());
        let mut reader = BufReader::new(framed.as_bytes());
        assert_eq!(read_message(&mut reader).unwrap()["id"], 1);
        assert!(read_message(&mut reader).is_none());
    }

    #[test]
    fn stops_closed_servers_after_grace_and_open_ones_when_idle() {
        let minute = Duration::from_secs(60);
        assert!(!should_stop(0, minute));
        assert!(should_stop(0, 2 * minute));
        assert!(!should_stop(3, 14 * minute));
        assert!(should_stop(3, 15 * minute));
    }

    #[test]
    fn drops_info_logs_only() {
        let log = |kind: u64| json!({ "method": "window/logMessage", "params": { "type": kind } });
        assert!(is_verbose_log(&log(4)));
        assert!(!is_verbose_log(&log(2)));
        assert!(!is_verbose_log(&json!({ "id": 1, "result": null })));
    }

    #[test]
    fn describes_script_documents_only() {
        let root = std::env::temp_dir().join("monocode-lsp-document");
        let file = root.join("src").join("a.tsx");
        std::fs::create_dir_all(file.parent().unwrap()).unwrap();
        std::fs::write(root.join("tsconfig.json"), "{}").unwrap();
        let described = document(&file).unwrap().unwrap();
        assert_eq!(described.language_id, "typescriptreact");
        assert_eq!(described.root, root.to_string_lossy());
        assert_eq!(described.uri, file_uri(&file).unwrap());
        assert!(document(&root.join("a.rs")).unwrap().is_none());
    }
}
