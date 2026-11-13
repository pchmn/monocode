use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex, Once, OnceLock};
use std::time::{Duration, Instant};

const INITIALIZE_TIMEOUT: Duration = Duration::from_secs(30);
// The first request on a large monorepo waits for its project to load.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(20);
// Kept briefly after its last file closes, so reopening one stays instant.
const CLOSED_GRACE: Duration = Duration::from_secs(2 * 60);
const IDLE_TIMEOUT: Duration = Duration::from_secs(15 * 60);
const REAP_INTERVAL: Duration = Duration::from_secs(30);
// Each worktree is its own repository root, hence its own server.
const MAX_SERVERS: usize = 2;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PositionRequest {
    path: String,
    text: String,
    /// 0-based, as LSP counts.
    line: u32,
    /// UTF-16 code units, the same unit as a CodeMirror offset.
    character: u32,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct DefinitionLocation {
    path: String,
    line: u32,
    character: u32,
}

#[tauri::command]
pub async fn lsp_definition(request: PositionRequest) -> Result<Vec<DefinitionLocation>, String> {
    tauri::async_runtime::spawn_blocking(move || definition(request))
        .await
        .map_err(|error| error.to_string())?
}

fn definition(request: PositionRequest) -> Result<Vec<DefinitionLocation>, String> {
    Ok(parse_locations(&position_request(
        "textDocument/definition",
        request,
    )?))
}

#[tauri::command]
pub async fn lsp_hover(request: PositionRequest) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        Ok(parse_hover(&position_request(
            "textDocument/hover",
            request,
        )?))
    })
    .await
    .map_err(|error| error.to_string())?
}

fn position_request(method: &str, request: PositionRequest) -> Result<Value, String> {
    let file = PathBuf::from(&request.path);
    let Some(language) = language_id(&file) else {
        return Ok(Value::Null);
    };
    if !file.is_file() {
        return Err(format!("{}: not a local file", file.display()));
    }
    let root = project_root(&file);
    let server = server_for(&root, &file)?;
    let uri = file_uri(&file)?;
    server.sync_document(&uri, language, &request.text)?;
    server.request(
        method,
        json!({
            "textDocument": { "uri": uri },
            "position": { "line": request.line, "character": request.character },
        }),
        REQUEST_TIMEOUT,
    )
}

#[tauri::command]
pub async fn lsp_close_document(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || close_document(Path::new(&path)))
        .await
        .map_err(|error| error.to_string())?
}

fn close_document(file: &Path) -> Result<(), String> {
    let root = project_root(file);
    let server = servers()
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .get(&root)
        .cloned();
    match server {
        Some(server) => server.close_document(&file_uri(file)?),
        None => Ok(()),
    }
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

fn parse_locations(result: &Value) -> Vec<DefinitionLocation> {
    let items = match result {
        Value::Array(items) => items.iter().collect(),
        Value::Object(_) => vec![result],
        _ => Vec::new(),
    };
    items
        .into_iter()
        .filter_map(|item| {
            // Location has `uri`/`range`; LocationLink has `targetUri`/`targetSelectionRange`.
            let uri = item
                .get("uri")
                .or_else(|| item.get("targetUri"))?
                .as_str()?;
            let range = item
                .get("targetSelectionRange")
                .or_else(|| item.get("range"))?;
            let start = range.get("start")?;
            let path = url::Url::parse(uri).ok()?.to_file_path().ok()?;
            Some(DefinitionLocation {
                path: path.to_string_lossy().into_owned(),
                line: start.get("line")?.as_u64()? as u32,
                character: start.get("character")?.as_u64()? as u32,
            })
        })
        .collect()
}

/// Hover contents as Markdown, whichever of the LSP shapes the server sent.
fn parse_hover(result: &Value) -> Option<String> {
    fn marked(value: &Value) -> Option<String> {
        match value {
            Value::String(text) => Some(text.clone()),
            Value::Object(object) => {
                let text = object.get("value")?.as_str()?;
                match object.get("language").and_then(Value::as_str) {
                    Some(language) => Some(format!("```{language}\n{text}\n```")),
                    None => Some(text.to_string()),
                }
            }
            _ => None,
        }
    }
    let markdown = match result.get("contents")? {
        Value::Array(items) => items
            .iter()
            .filter_map(marked)
            .collect::<Vec<_>>()
            .join("\n\n"),
        contents => marked(contents)?,
    };
    let markdown = markdown.trim();
    (!markdown.is_empty()).then(|| markdown.to_string())
}

type Pending = Arc<Mutex<HashMap<i64, mpsc::Sender<Result<Value, String>>>>>;

struct Server {
    stdin: Arc<Mutex<ChildStdin>>,
    child: Mutex<Child>,
    pending: Pending,
    next_id: AtomicI64,
    alive: Arc<AtomicBool>,
    versions: Mutex<HashMap<String, i64>>,
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

fn server_for(root: &Path, file: &Path) -> Result<Arc<Server>, String> {
    start_reaper();
    let mut servers = servers().lock().unwrap_or_else(|e| e.into_inner());
    if let Some(server) = servers.get(root) {
        if server.alive.load(Ordering::SeqCst) {
            server.touch();
            return Ok(server.clone());
        }
        servers.remove(root);
    }
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
    let server = Arc::new(Server::spawn(&binary, root)?);
    servers.insert(root.to_path_buf(), server.clone());
    Ok(server)
}

impl Server {
    fn spawn(binary: &Path, root: &Path) -> Result<Self, String> {
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
        let pending: Pending = Default::default();
        let alive = Arc::new(AtomicBool::new(true));
        {
            let stdin = stdin.clone();
            let pending = pending.clone();
            let alive = alive.clone();
            std::thread::spawn(move || {
                read_messages(BufReader::new(stdout), &stdin, &pending);
                alive.store(false, Ordering::SeqCst);
                pending.lock().unwrap_or_else(|e| e.into_inner()).clear();
            });
        }
        let server = Server {
            stdin,
            child: Mutex::new(child),
            pending,
            next_id: AtomicI64::new(1),
            alive,
            versions: Default::default(),
            last_used: Mutex::new(Instant::now()),
        };
        let root_uri = file_uri(root)?;
        let name = root
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_default();
        let initialized = server.request(
            "initialize",
            json!({
                "processId": std::process::id(),
                "rootUri": root_uri,
                "workspaceFolders": [{ "uri": root_uri, "name": name }],
                "capabilities": {
                    "textDocument": {
                        "definition": { "linkSupport": true },
                        "hover": { "contentFormat": ["markdown", "plaintext"] },
                        "synchronization": { "didSave": false },
                    },
                },
            }),
            INITIALIZE_TIMEOUT,
        );
        if let Err(error) = initialized {
            server.kill();
            return Err(error);
        }
        server.notify("initialized", json!({}))?;
        Ok(server)
    }

    fn sync_document(&self, uri: &str, language: &str, text: &str) -> Result<(), String> {
        let mut versions = self.versions.lock().unwrap_or_else(|e| e.into_inner());
        match versions.get_mut(uri) {
            Some(version) => {
                *version += 1;
                self.notify(
                    "textDocument/didChange",
                    json!({
                        "textDocument": { "uri": uri, "version": *version },
                        "contentChanges": [{ "text": text }],
                    }),
                )
            }
            None => {
                versions.insert(uri.to_string(), 1);
                self.notify(
                    "textDocument/didOpen",
                    json!({
                        "textDocument": {
                            "uri": uri,
                            "languageId": language,
                            "version": 1,
                            "text": text,
                        },
                    }),
                )
            }
        }
    }

    fn close_document(&self, uri: &str) -> Result<(), String> {
        let removed = self
            .versions
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(uri)
            .is_some();
        self.touch();
        if !removed {
            return Ok(());
        }
        self.notify(
            "textDocument/didClose",
            json!({ "textDocument": { "uri": uri } }),
        )
    }

    fn touch(&self) {
        *self.last_used.lock().unwrap_or_else(|e| e.into_inner()) = Instant::now();
    }

    fn last_used(&self) -> Instant {
        *self.last_used.lock().unwrap_or_else(|e| e.into_inner())
    }

    fn idle_out(&self) -> bool {
        let open = self
            .versions
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .len();
        should_stop(open, self.last_used().elapsed())
    }

    fn request(&self, method: &str, params: Value, timeout: Duration) -> Result<Value, String> {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let (sender, receiver) = mpsc::channel();
        self.pending
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(id, sender);
        write_message(
            &self.stdin,
            &json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params }),
        )?;
        let response = receiver.recv_timeout(timeout);
        self.pending
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(&id);
        match response {
            Ok(result) => result,
            Err(mpsc::RecvTimeoutError::Timeout) => Err(format!("tsgo: {method} timed out")),
            Err(mpsc::RecvTimeoutError::Disconnected) => Err("tsgo exited".to_string()),
        }
    }

    fn notify(&self, method: &str, params: Value) -> Result<(), String> {
        write_message(
            &self.stdin,
            &json!({ "jsonrpc": "2.0", "method": method, "params": params }),
        )
    }

    fn kill(&self) {
        let _ = self.child.lock().unwrap_or_else(|e| e.into_inner()).kill();
    }
}

impl Drop for Server {
    fn drop(&mut self) {
        self.kill();
    }
}

fn write_message(stdin: &Mutex<ChildStdin>, message: &Value) -> Result<(), String> {
    let body = message.to_string();
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

fn read_messages(mut reader: impl BufRead, stdin: &Mutex<ChildStdin>, pending: &Pending) {
    while let Some(message) = read_message(&mut reader) {
        let id = message.get("id").cloned();
        match (message.get("method"), id) {
            // A request from the server must be answered or it may stall.
            (Some(method), Some(id)) => {
                let result = server_request_result(method.as_str().unwrap_or(""), &message);
                let _ = write_message(
                    stdin,
                    &json!({ "jsonrpc": "2.0", "id": id, "result": result }),
                );
            }
            (None, Some(id)) => {
                let Some(id) = id.as_i64() else { continue };
                let sender = pending
                    .lock()
                    .unwrap_or_else(|e| e.into_inner())
                    .remove(&id);
                if let Some(sender) = sender {
                    let result = match message.get("error") {
                        Some(error) => Err(format!(
                            "tsgo: {}",
                            error
                                .get("message")
                                .and_then(Value::as_str)
                                .unwrap_or("error")
                        )),
                        None => Ok(message.get("result").cloned().unwrap_or(Value::Null)),
                    };
                    let _ = sender.send(result);
                }
            }
            _ => {}
        }
    }
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
    fn parses_locations_and_location_links() {
        let root = if cfg!(windows) { "C:/repo" } else { "/repo" };
        let uri = url::Url::from_file_path(Path::new(root).join("a.ts"))
            .unwrap()
            .to_string();
        let location = json!({
            "uri": uri,
            "range": { "start": { "line": 7, "character": 13 }, "end": { "line": 7, "character": 20 } },
        });
        let link = json!({
            "targetUri": uri,
            "targetRange": { "start": { "line": 1, "character": 0 } },
            "targetSelectionRange": { "start": { "line": 2, "character": 4 } },
        });
        let path = Path::new(root).join("a.ts").to_string_lossy().into_owned();
        assert_eq!(
            parse_locations(&json!([location, link])),
            vec![
                DefinitionLocation {
                    path: path.clone(),
                    line: 7,
                    character: 13
                },
                DefinitionLocation {
                    path,
                    line: 2,
                    character: 4
                },
            ]
        );
        assert!(parse_locations(&Value::Null).is_empty());
    }

    #[test]
    fn parses_every_hover_shape() {
        let markup =
            json!({ "contents": { "kind": "markdown", "value": "```ts\nconst a: A\n```" } });
        assert_eq!(parse_hover(&markup).unwrap(), "```ts\nconst a: A\n```");
        let marked =
            json!({ "contents": [{ "language": "typescript", "value": "type A = 1" }, "Docs"] });
        assert_eq!(
            parse_hover(&marked).unwrap(),
            "```typescript\ntype A = 1\n```\n\nDocs"
        );
        assert!(parse_hover(&json!({ "contents": "" })).is_none());
        assert!(parse_hover(&Value::Null).is_none());
    }

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
    fn only_handles_script_files() {
        assert_eq!(language_id(Path::new("a.tsx")), Some("typescriptreact"));
        assert_eq!(language_id(Path::new("a.rs")), None);
    }
}
