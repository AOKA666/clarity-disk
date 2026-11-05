use regex::Regex;
use serde::Deserialize;
use std::sync::OnceLock;

#[derive(Debug, Clone, Deserialize)]
pub struct ClarityRule {
    pub id: String,
    #[serde(rename = "pathGlob")]
    pub path_glob: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "ownerApp")]
    pub owner_app: String,
    pub purpose: String,
    pub risk: String,
    pub bucket: String,
    pub confidence: f64,
}

struct CompiledRule {
    rule: ClarityRule,
    re: Regex,
}

static COMPILED: OnceLock<Vec<CompiledRule>> = OnceLock::new();

fn normalize_windows_path(path: &str) -> String {
    collapse_backslashes(&path.replace('/', "\\").to_lowercase())
}

/// 规则 JSON 中 `\\\\` 表示 `\`；与 walkdir 输出的单反斜杠路径对齐。
fn collapse_backslashes(path: &str) -> String {
    let mut out = String::with_capacity(path.len());
    let mut chars = path.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '\\' {
            out.push('\\');
            while chars.peek() == Some(&'\\') {
                chars.next();
            }
        } else {
            out.push(ch);
        }
    }
    out
}

fn glob_to_regexp(glob: &str) -> String {
    let normalized = normalize_windows_path(glob);
    let mut pattern = String::new();
    let chars: Vec<char> = normalized.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let ch = chars[i];
        let next = chars.get(i + 1).copied();
        if ch == '*' && next == Some('*') {
            pattern.push_str(".*");
            i += 2;
            continue;
        }
        if ch == '*' {
            pattern.push_str("[^\\\\]*");
            i += 1;
            continue;
        }
        if "\\.[]{}()+?^$|".contains(ch) {
            pattern.push('\\');
        }
        pattern.push(ch);
        i += 1;
    }
    format!("(?i)^{pattern}$")
}

#[allow(dead_code)]
pub fn rules_catalog() -> Vec<ClarityRule> {
    compiled_rules()
        .iter()
        .map(|c| c.rule.clone())
        .collect()
}

fn init_compiled() -> Vec<CompiledRule> {
    let raw = include_str!("../../../packages/rules/rules.seed.json");
    let rules: Vec<ClarityRule> = serde_json::from_str(raw).expect("rules.seed.json must parse");
    rules
        .into_iter()
        .map(|rule| {
            let re = Regex::new(&glob_to_regexp(&rule.path_glob))
                .unwrap_or_else(|e| panic!("invalid glob {}: {e}", rule.id));
            CompiledRule { rule, re }
        })
        .collect()
}

fn compiled_rules() -> &'static [CompiledRule] {
    COMPILED.get_or_init(init_compiled)
}

pub fn match_rule_for_path(windows_path: &str) -> Option<&'static ClarityRule> {
    let target = normalize_windows_path(windows_path);
    let mut best: Option<&ClarityRule> = None;
    let mut best_score = -1.0;
    for entry in compiled_rules() {
        if entry.re.is_match(&target) && entry.rule.confidence > best_score {
            best = Some(&entry.rule);
            best_score = entry.rule.confidence;
        }
    }
    best
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_downloads() {
        let raw = include_str!("../../../packages/rules/rules.seed.json");
        let rules: Vec<ClarityRule> = serde_json::from_str(raw).unwrap();
        let dl = rules.iter().find(|r| r.id == "downloads").unwrap();
        assert_eq!(dl.bucket, "user");
        let pat = glob_to_regexp(&dl.path_glob);
        let re = Regex::new(&pat).unwrap();
        let p = normalize_windows_path(r"C:\Users\Alice\Downloads\setup.exe");
        assert!(re.is_match(&p), "pat={pat} path={p}");
        let m = match_rule_for_path(r"C:\Users\Alice\Downloads\setup.exe").expect("downloads rule");
        assert_eq!(m.id, "downloads");
    }

    #[test]
    fn matches_jianyingpro() {
        let m = match_rule_for_path(
            r"C:\Users\Alice\AppData\Local\JianyingPro\User Data\test",
        )
        .expect("jianyingpro");
        assert_eq!(m.id, "jianyingpro");
        assert_eq!(m.bucket, "user");
    }

    #[test]
    fn seed_has_m25_rule_count() {
        let raw = include_str!("../../../packages/rules/rules.seed.json");
        let rules: Vec<ClarityRule> = serde_json::from_str(raw).unwrap();
        assert!(
            rules.len() >= 50,
            "M2.5 expects at least 50 seed rules, got {}",
            rules.len()
        );
        assert!(rules.iter().any(|r| r.id == "windows-old"));
        assert!(rules.iter().any(|r| r.id == "jianyingpro"));
        assert!(
            rules.len() >= 100,
            "batch-2 expects at least 100 seed rules, got {}",
            rules.len()
        );
        assert!(rules.iter().all(|r| !r.bucket.is_empty()));
    }
}
