use crate::rules::match_rule_for_path;
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    pub bytes_scanned: u64,
    pub paths_scanned: u64,
    pub current_path: String,
    /// 相对 C: 已用空间的近似进度（已统计文件字节 / 盘已用容量）。
    pub percent: Option<f32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkippedEntry {
    pub path: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpaceRow {
    pub id: String,
    pub label: String,
    pub size_bytes: u64,
    pub path: String,
    pub rule_id: Option<String>,
    pub purpose: Option<String>,
    pub risk: Option<String>,
    pub is_unknown: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestionTotals {
    pub safe_bytes: u64,
    pub confirm_bytes: u64,
    pub unknown_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub drive: String,
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub free_bytes: u64,
    pub bytes_scanned: u64,
    pub paths_scanned: u64,
    pub skipped: Vec<SkippedEntry>,
    pub by_app: Vec<SpaceRow>,
    pub by_purpose: Vec<SpaceRow>,
    pub unknown_rows: Vec<SpaceRow>,
    pub suggestions: SuggestionTotals,
}

pub struct ScanOptions {
    pub root: PathBuf,
    pub progress_every: u64,
    pub used_bytes_hint: u64,
}

impl Default for ScanOptions {
    fn default() -> Self {
        Self {
            root: PathBuf::from(r"C:\"),
            progress_every: 400,
            used_bytes_hint: 1,
        }
    }
}

pub type ProgressCallback = Arc<dyn Fn(ScanProgress) + Send + Sync>;

struct RuleAgg {
    bytes: u64,
    sample_path: String,
    rule_id: String,
    owner_app: String,
    purpose: String,
    risk: String,
}

pub fn scan_volume(options: ScanOptions, on_progress: ProgressCallback) -> ScanResult {
    let mut skipped_map: HashMap<String, String> = HashMap::new();
    let mut rule_aggs: HashMap<String, RuleAgg> = HashMap::new();
    let mut unknown_bytes: u64 = 0;
    let mut unknown_sample: Option<String> = None;
    let mut unknown_largest: u64 = 0;

    let bytes_scanned = AtomicU64::new(0);
    let paths_scanned = AtomicU64::new(0);
    let last_emit = Arc::new(std::sync::Mutex::new(Instant::now()));
    let used_hint = options.used_bytes_hint.max(1);

    let root_display = options
        .root
        .to_string_lossy()
        .trim_end_matches('\\')
        .to_string();
    let drive = if root_display.len() >= 2 && root_display.as_bytes()[1] == b':' {
        format!("{}:", &root_display[..1])
    } else {
        root_display.clone()
    };

    let walker = WalkDir::new(&options.root)
        .follow_links(false)
        .same_file_system(false);

    for entry in walker.into_iter() {
        match entry {
            Ok(de) => {
                if !de.file_type().is_file() {
                    continue;
                }
                let path_str = de.path().display().to_string();
                let meta = match de.metadata() {
                    Ok(m) => m,
                    Err(e) => {
                        record_skip(&mut skipped_map, &path_str, e.to_string());
                        continue;
                    }
                };
                let size = meta.len();
                bytes_scanned.fetch_add(size, Ordering::Relaxed);
                paths_scanned.fetch_add(1, Ordering::Relaxed);

                if let Some(rule) = match_rule_for_path(&path_str) {
                    let entry = rule_aggs.entry(rule.id.clone()).or_insert_with(|| RuleAgg {
                        bytes: 0,
                        sample_path: path_str.clone(),
                        rule_id: rule.id.clone(),
                        owner_app: rule.owner_app.clone(),
                        purpose: rule.purpose.clone(),
                        risk: rule.risk.clone(),
                    });
                    entry.bytes += size;
                    if path_str.len() > entry.sample_path.len() {
                        entry.sample_path = path_str.clone();
                    }
                } else {
                    unknown_bytes += size;
                    if size >= unknown_largest {
                        unknown_largest = size;
                        unknown_sample = Some(path_str.clone());
                    }
                }

                let n = paths_scanned.load(Ordering::Relaxed);
                if n % options.progress_every == 0 {
                    maybe_emit(
                        &on_progress,
                        &last_emit,
                        &bytes_scanned,
                        &paths_scanned,
                        &path_str,
                        used_hint,
                    );
                }
            }
            Err(err) => {
                let (path, reason) = skip_from_walk_error(err);
                record_skip(&mut skipped_map, &path, reason);
            }
        }
    }

    maybe_emit(
        &on_progress,
        &last_emit,
        &bytes_scanned,
        &paths_scanned,
        "",
        used_hint,
    );

    let (total_bytes, free_bytes) = volume_capacity(&options.root);
    let used_bytes = total_bytes.saturating_sub(free_bytes);

    let mut by_app_map: HashMap<String, (u64, String, String, String, String)> = HashMap::new();
    for agg in rule_aggs.values() {
        let e = by_app_map
            .entry(agg.owner_app.clone())
            .or_insert((0, agg.sample_path.clone(), agg.rule_id.clone(), agg.purpose.clone(), agg.risk.clone()));
        e.0 += agg.bytes;
        if agg.bytes > 0 && agg.sample_path.len() > e.1.len() {
            e.1 = agg.sample_path.clone();
            e.2 = agg.rule_id.clone();
            e.3 = agg.purpose.clone();
            e.4 = agg.risk.clone();
        }
    }

    let mut by_app: Vec<SpaceRow> = by_app_map
        .into_iter()
        .map(|(owner, (bytes, path, rule_id, purpose, risk))| SpaceRow {
            id: row_id("app", &owner, &rule_id),
            label: owner,
            size_bytes: bytes,
            path,
            rule_id: Some(rule_id),
            purpose: Some(purpose),
            risk: Some(risk),
            is_unknown: false,
        })
        .collect();
    by_app.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));

    let mut purpose_map: HashMap<String, (u64, String, String, String, String)> = HashMap::new();
    for agg in rule_aggs.values() {
        let e = purpose_map
            .entry(agg.purpose.clone())
            .or_insert((0, agg.sample_path.clone(), agg.rule_id.clone(), agg.purpose.clone(), agg.risk.clone()));
        e.0 += agg.bytes;
    }

    let mut by_purpose: Vec<SpaceRow> = purpose_map
        .into_iter()
        .map(|(purpose, (bytes, path, rule_id, purpose_label, risk))| SpaceRow {
            id: row_id("purpose", &purpose, &rule_id),
            label: purpose,
            size_bytes: bytes,
            path,
            rule_id: Some(rule_id),
            purpose: Some(purpose_label),
            risk: Some(risk),
            is_unknown: false,
        })
        .collect();
    by_purpose.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));

    let mut safe_bytes = 0u64;
    let mut confirm_bytes = 0u64;
    for agg in rule_aggs.values() {
        match agg.risk.as_str() {
            "safe" => safe_bytes += agg.bytes,
            "confirm" => confirm_bytes += agg.bytes,
            _ => {}
        }
    }

    let unknown_rows = if unknown_bytes > 0 {
        vec![SpaceRow {
            id: "unknown".into(),
            label: "尚未识别".into(),
            size_bytes: unknown_bytes,
            path: unknown_sample.unwrap_or_else(|| format!(r"{drive}\\")),
            rule_id: None,
            purpose: None,
            risk: None,
            is_unknown: true,
        }]
    } else {
        vec![]
    };

    let mut skipped: Vec<SkippedEntry> = skipped_map
        .into_iter()
        .map(|(path, reason)| SkippedEntry { path, reason })
        .collect();
    skipped.sort_by(|a, b| a.path.cmp(&b.path));

    ScanResult {
        drive,
        total_bytes,
        used_bytes,
        free_bytes,
        bytes_scanned: bytes_scanned.load(Ordering::Relaxed),
        paths_scanned: paths_scanned.load(Ordering::Relaxed),
        skipped,
        by_app,
        by_purpose,
        unknown_rows,
        suggestions: SuggestionTotals {
            safe_bytes,
            confirm_bytes,
            unknown_bytes,
        },
    }
}

fn maybe_emit(
    on_progress: &ProgressCallback,
    last_emit: &Arc<std::sync::Mutex<Instant>>,
    bytes_scanned: &AtomicU64,
    paths_scanned: &AtomicU64,
    current_path: &str,
    used_hint: u64,
) {
    let mut last = last_emit.lock().expect("progress lock");
    if last.elapsed() < Duration::from_millis(120) && !current_path.is_empty() {
        return;
    }
    *last = Instant::now();
    let bytes = bytes_scanned.load(Ordering::Relaxed);
    let paths = paths_scanned.load(Ordering::Relaxed);
    let percent = Some((bytes as f64 / used_hint as f64 * 100.0).min(99.9) as f32);
    on_progress(ScanProgress {
        bytes_scanned: bytes,
        paths_scanned: paths,
        current_path: current_path.to_string(),
        percent,
    });
}

fn record_skip(map: &mut HashMap<String, String>, path: &str, reason: String) {
    map.entry(path.to_string()).or_insert(reason);
}

fn skip_from_walk_error(err: walkdir::Error) -> (String, String) {
    if let Some(inner) = err.io_error() {
        let path = err
            .path()
            .map(|p| p.display().to_string())
            .unwrap_or_else(|| "<unknown>".into());
        return (path, inner.to_string());
    }
    (
        err.path()
            .map(|p| p.display().to_string())
            .unwrap_or_else(|| "<unknown>".into()),
        err.to_string(),
    )
}

fn slug_id(label: &str) -> String {
    let s: String = label
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect();
    s.trim_matches('-').to_string()
}

fn row_id(scope: &str, label: &str, rule_id: &str) -> String {
    let slug = slug_id(label);
    if slug.is_empty() {
        format!("{scope}-{rule_id}")
    } else {
        format!("{scope}-{slug}-{rule_id}")
    }
}

fn volume_capacity(root: &Path) -> (u64, u64) {
    #[cfg(windows)]
    {
        return windows_capacity(root);
    }
    #[cfg(not(windows))]
    {
        let _ = root;
        (0, 0)
    }
}

#[cfg(windows)]
fn windows_capacity(root: &Path) -> (u64, u64) {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;

    let root_str = root.to_string_lossy();
    let mut wide: Vec<u16> = OsStr::new(root_str.as_ref())
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    if wide.len() <= 2 {
        wide = r"C:\\"
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
    }

    let mut free_bytes = 0u64;
    let mut total_bytes = 0u64;
    let ok = unsafe {
        GetDiskFreeSpaceExW(
            wide.as_ptr(),
            &mut free_bytes as *mut u64,
            &mut total_bytes as *mut u64,
            std::ptr::null_mut(),
        )
    };
    if ok == 0 {
        (0, 0)
    } else {
        (total_bytes, free_bytes)
    }
}

#[cfg(windows)]
pub fn scan_c_drive(on_progress: ProgressCallback) -> ScanResult {
    let root = PathBuf::from(r"C:\");
    let (total, free) = volume_capacity(&root);
    let used = total.saturating_sub(free);
    scan_volume(
        ScanOptions {
            root,
            used_bytes_hint: used,
            ..ScanOptions::default()
        },
        on_progress,
    )
}

#[cfg(not(windows))]
pub fn scan_c_drive_stub(_on_progress: ProgressCallback) -> Result<ScanResult, String> {
    Err("C: scan is only available on Windows".into())
}
