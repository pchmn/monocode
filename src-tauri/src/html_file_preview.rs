use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use crate::artifacts::{with_bootstrap, HTML_CSP};

const PATH_PREFIX: &str = "/file-preview/";
// Each open HTML editor holds one entry; the cap only guards against leaks.
const MAX_ENTRIES: usize = 64;

fn pages() -> &'static Mutex<HashMap<String, String>> {
    static PAGES: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
    PAGES.get_or_init(Default::default)
}

fn valid_key(key: &str) -> bool {
    (1..=64).contains(&key.len()) && key.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
}

#[tauri::command]
pub fn html_file_preview_set(key: String, body: String) -> Result<(), String> {
    if !valid_key(&key) {
        return Err("invalid preview key".into());
    }
    let mut pages = pages().lock().map_err(|e| e.to_string())?;
    if !pages.contains_key(&key) && pages.len() >= MAX_ENTRIES {
        return Err("too many HTML previews open".into());
    }
    pages.insert(key, body);
    Ok(())
}

#[tauri::command]
pub fn html_file_preview_clear(key: String) {
    if let Ok(mut pages) = pages().lock() {
        pages.remove(&key);
    }
}

/// Answers `/file-preview/<key>` on the artifact scheme, with the same CSP and
/// bootstrap as `html` artifacts; `None` leaves other paths to the artifacts.
pub fn serve(request: &tauri::http::Request<Vec<u8>>) -> Option<tauri::http::Response<Vec<u8>>> {
    let key = request.uri().path().strip_prefix(PATH_PREFIX)?;
    let body = (request.method() == tauri::http::Method::GET && valid_key(key))
        .then(|| pages().lock().ok()?.get(key).cloned())
        .flatten();
    let response = match body {
        Some(body) => tauri::http::Response::builder()
            .status(200)
            .header("Content-Type", "text/html; charset=utf-8")
            .header("Content-Security-Policy", HTML_CSP)
            .header("Cache-Control", "no-store")
            .header("X-Content-Type-Options", "nosniff")
            .body(with_bootstrap(&body).into_bytes()),
        None => tauri::http::Response::builder()
            .status(404)
            .body(Vec::new()),
    };
    Some(response.unwrap_or_default())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn get(path: &str) -> tauri::http::Request<Vec<u8>> {
        tauri::http::Request::builder()
            .uri(format!("monoartifact://localhost{path}"))
            .body(Vec::new())
            .unwrap()
    }

    #[test]
    fn serves_a_stored_page_with_the_artifact_csp() {
        html_file_preview_set("test-serve".into(), "<p>hi</p>".into()).unwrap();
        let response = serve(&get("/file-preview/test-serve")).unwrap();
        assert_eq!(response.status(), 200);
        assert_eq!(
            response.headers()["Content-Security-Policy"]
                .to_str()
                .unwrap(),
            HTML_CSP
        );
        let body = String::from_utf8(response.body().clone()).unwrap();
        assert!(body.contains("<p>hi</p>") && body.contains("monocode:ready"));
        html_file_preview_clear("test-serve".into());
        assert_eq!(
            serve(&get("/file-preview/test-serve")).unwrap().status(),
            404
        );
    }

    #[test]
    fn leaves_artifact_paths_alone_and_rejects_bad_keys() {
        assert!(serve(&get("/some-artifact-id")).is_none());
        assert_eq!(serve(&get("/file-preview/../x")).unwrap().status(), 404);
        assert!(html_file_preview_set("a/b".into(), String::new()).is_err());
    }
}
