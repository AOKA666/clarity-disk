use scanner::{ScanProgress, ScanResult};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

#[tauri::command]
fn scanner_status() -> String {
    scanner::scanner_status_message().to_string()
}

#[tauri::command]
async fn start_c_scan(app: AppHandle) -> Result<ScanResult, String> {
    let app_progress = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || run_scan(app_progress))
        .await
        .map_err(|e| e.to_string())??;

    app.emit("scan-complete", &result)
        .map_err(|e| e.to_string())?;
    Ok(result)
}

fn run_scan(app: AppHandle) -> Result<ScanResult, String> {
    let progress_cb: scanner::ProgressCallback = Arc::new(move |p: ScanProgress| {
        let _ = app.emit("scan-progress", &p);
    });

    #[cfg(windows)]
    {
        Ok(scanner::scan_c_drive(progress_cb))
    }

    #[cfg(not(windows))]
    {
        scanner::scan_c_drive(progress_cb)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![scanner_status, start_c_scan])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
