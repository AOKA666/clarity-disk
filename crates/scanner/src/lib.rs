//! Windows C: 只读扫描将在 M2 实现。M1 仅为占位 crate。

/// 返回扫描器就绪状态（供 Tauri 侧探测）。
pub fn scanner_status_message() -> &'static str {
    "scanner stub — real C: walk ships in M2 (Windows only)"
}

/// M2：异步扫描入口占位。
pub fn scan_not_implemented() -> Result<(), String> {
    Err("M2: implement scan_c_drive() on Windows".into())
}
