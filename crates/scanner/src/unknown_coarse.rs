//! 未命中规则的文件按「父目录 / 厂商名」粗分组，避免单行巨大的「尚未识别」。

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UnknownCoarseKey {
    pub id: String,
    pub label: String,
    pub bucket: &'static str,
    /// 用于解释卡与列表 meta 的典型目录前缀（含 * 通配符）。
    pub dir_hint: String,
}

pub fn classify_unknown_path(windows_path: &str) -> UnknownCoarseKey {
    let normalized = windows_path.replace('/', "\\");
    let parts = path_parts(&normalized);
    if parts.is_empty() {
        return fallback();
    }
    let lower: Vec<String> = parts.iter().map(|p| p.to_lowercase()).collect();

    if lower.len() >= 5 && lower[0] == "users" && lower[2] == "appdata" {
        return appdata_group(&parts, &lower);
    }

    if lower[0] == "users" && lower.len() >= 3 && lower[2] != "appdata" {
        let folder = &parts[2];
        return UnknownCoarseKey {
            id: format!("userdir-{}", slug_part(folder)),
            label: folder.to_string(),
            bucket: "user",
            dir_hint: format!(r"C:\Users\*\{folder}\**"),
        };
    }

    if (lower[0] == "program files" || lower[0] == "program files (x86)") && parts.len() >= 2 {
        let vendor = &parts[1];
        let scope = if lower[0] == "program files (x86)" {
            "Program Files (x86)"
        } else {
            "Program Files"
        };
        let bucket = bucket_for_program_vendor(vendor);
        return UnknownCoarseKey {
            id: format!("pf-{}", slug_part(vendor)),
            label: if bucket == "user" {
                vendor.to_string()
            } else {
                format!("{vendor} · {scope}")
            },
            bucket,
            dir_hint: format!(r"C:\{scope}\{vendor}\**"),
        };
    }

    if lower[0] == "programdata" && parts.len() >= 2 {
        let vendor = &parts[1];
        return UnknownCoarseKey {
            id: format!("pd-{}", slug_part(vendor)),
            label: format!("{vendor} · ProgramData"),
            bucket: bucket_for_program_vendor(vendor),
            dir_hint: format!(r"C:\ProgramData\{vendor}\**"),
        };
    }

    if lower[0] == "windows" {
        let sub = parts.get(1).map(String::as_str).unwrap_or("其他");
        return UnknownCoarseKey {
            id: format!("win-{}", slug_part(sub)),
            label: format!("Windows \\ {sub}"),
            bucket: "system",
            dir_hint: format!(r"C:\Windows\{sub}\**"),
        };
    }

    if parts.len() >= 2 {
        return UnknownCoarseKey {
            id: format!("top-{}-{}", slug_part(&parts[0]), slug_part(&parts[1])),
            label: format!("{} \\ {}", parts[0], parts[1]),
            bucket: "user",
            dir_hint: format!(r"C:\{}\{}\**", parts[0], parts[1]),
        };
    }

    UnknownCoarseKey {
        id: format!("top-{}", slug_part(&parts[0])),
        label: parts[0].clone(),
        bucket: "user",
        dir_hint: format!(r"C:\{}\**", parts[0]),
    }
}

fn path_parts(normalized: &str) -> Vec<String> {
    let rest = normalized
        .strip_prefix(r"C:\")
        .or_else(|| normalized.strip_prefix(r"c:\"))
        .or_else(|| normalized.strip_prefix(r"C:/"))
        .or_else(|| normalized.strip_prefix(r"c:/"))
        .unwrap_or(normalized);
    rest.split('\\')
        .filter(|s| !s.is_empty())
        .map(String::from)
        .collect()
}

fn appdata_group(parts: &[String], lower: &[String]) -> UnknownCoarseKey {
    let flavor = &lower[3];
    let vendor = &parts[4];
    let flavor_win = match flavor.as_str() {
        "local" => "Local",
        "roaming" => "Roaming",
        "locallow" => "LocalLow",
        other => other,
    };
    let flavor_label = match flavor.as_str() {
        "local" => "AppData Local",
        "roaming" => "AppData Roaming",
        "locallow" => "AppData LocalLow",
        other => other,
    };
    let bucket = bucket_for_appdata_vendor(vendor, flavor);
    let label = if bucket == "user" {
        vendor.to_string()
    } else {
        format!("{vendor} · {flavor_label}")
    };
    UnknownCoarseKey {
        id: format!("appdata-{flavor}-{}", slug_part(vendor)),
        label,
        bucket,
        dir_hint: format!(r"C:\Users\*\AppData\{flavor_win}\{vendor}\**"),
    }
}

fn bucket_for_appdata_vendor(vendor: &str, flavor: &str) -> &'static str {
    let v = vendor.to_lowercase();
    if v.contains("cache")
        || v.contains("temp")
        || v.ends_with("crash")
        || v == "d3dscache"
        || v == "placeholder"
    {
        return "slim";
    }
    if flavor == "local" {
        let slimish = [
            "packages",
            "microsoft",
            "google",
            "cache",
            "crashdumps",
            "squirrel",
            "elevatedsoftware",
        ];
        if slimish.iter().any(|h| v.contains(h)) {
            return "slim";
        }
    }
    "user"
}

fn bucket_for_program_vendor(vendor: &str) -> &'static str {
    let v = vendor.to_lowercase();
    if v.contains("windows") || v.contains("microsoft") {
        return "system";
    }
    "slim"
}

fn slug_part(part: &str) -> String {
    let s: String = part
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

fn fallback() -> UnknownCoarseKey {
    UnknownCoarseKey {
        id: "unknown-other".into(),
        label: "其它未匹配路径".into(),
        bucket: "user",
        dir_hint: r"C:\".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn groups_appdata_local_vendor() {
        let k = classify_unknown_path(
            r"C:\Users\Alice\AppData\Local\JianyingPro\User Data\Projects\foo.mp4",
        );
        assert_eq!(k.id, "appdata-local-jianyingpro");
        assert_eq!(k.label, "JianyingPro");
        assert!(k.dir_hint.contains("JianyingPro"));
    }

    #[test]
    fn groups_program_files() {
        let k = classify_unknown_path(r"C:\Program Files\VendorX\bin\app.exe");
        assert_eq!(k.id, "pf-vendorx");
        assert!(k.label.contains("VendorX"));
    }

    #[test]
    fn windows_subfolder_is_system() {
        let k = classify_unknown_path(r"C:\Windows\Fonts\arial.ttf");
        assert_eq!(k.bucket, "system");
        assert!(k.id.starts_with("win-"));
    }
}
