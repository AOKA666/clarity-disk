//! Clarity Disk C: 只读卷扫描（M2）。

mod rules;
mod unknown_coarse;
mod walk;

pub use rules::{match_rule_for_path, ClarityRule};
pub use walk::{scan_volume, ProgressCallback, ScanOptions, ScanProgress, ScanResult, SkippedEntry};

#[cfg(windows)]
pub use walk::scan_c_drive;

#[cfg(not(windows))]
pub use walk::scan_c_drive_stub as scan_c_drive;

/// 返回扫描器就绪状态（供 Tauri 侧探测）。
pub fn scanner_status_message() -> &'static str {
    #[cfg(windows)]
    {
        "scanner ready — read-only C: walk (Windows)"
    }
    #[cfg(not(windows))]
    {
        "scanner stub — C: scan requires Windows"
    }
}
