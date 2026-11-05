import seedRules from "../rules.seed.json";
import type schema from "../schema.json";

export type RiskLevel = "safe" | "confirm" | "forbidden";

export interface ClarityRule {
  id: string;
  pathGlob: string;
  displayName: string;
  ownerApp: string;
  purpose: string;
  risk: RiskLevel;
  what: string;
  riskText: string;
  advice: string;
  evidence: string[];
  confidence: number;
}

export type RuleSchema = typeof schema;

/** 全部种子规则（M1 约 20 条，M3 目标 ≥100）。 */
export const rules: ClarityRule[] = seedRules as ClarityRule[];

export function normalizeWindowsPath(path: string): string {
  return collapseBackslashes(path.replace(/\//g, "\\").toLowerCase());
}

function collapseBackslashes(path: string): string {
  let out = "";
  for (let i = 0; i < path.length; i++) {
    const ch = path[i];
    if (ch === "\\") {
      out += "\\";
      while (path[i + 1] === "\\") i++;
    } else {
      out += ch;
    }
  }
  return out;
}

/** 将 schema 中的 glob 转为简单正则（仅支持 * 与 **）。 */
export function globToRegExp(glob: string): RegExp {
  const normalized = normalizeWindowsPath(glob);
  let pattern = "";
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    const next = normalized[i + 1];
    if (ch === "*" && next === "*") {
      pattern += ".*";
      i++;
      continue;
    }
    if (ch === "*") {
      pattern += "[^\\\\]*";
      continue;
    }
    if ("\\.[]{}()+?^$|".includes(ch)) {
      pattern += "\\" + ch;
    } else {
      pattern += ch;
    }
  }
  return new RegExp("^" + pattern + "$", "i");
}

/** 对 Windows 路径匹配规则，按 confidence 降序返回最佳命中。 */
export function matchRuleForPath(
  windowsPath: string,
  catalog: ClarityRule[] = rules,
): ClarityRule | undefined {
  const target = normalizeWindowsPath(windowsPath);
  let best: ClarityRule | undefined;
  let bestScore = -1;
  for (const rule of catalog) {
    const re = globToRegExp(rule.pathGlob);
    if (re.test(target) && rule.confidence > bestScore) {
      best = rule;
      bestScore = rule.confidence;
    }
  }
  return best;
}

/** 按 id 查找规则。 */
export function getRuleById(id: string): ClarityRule | undefined {
  return rules.find((r) => r.id === id);
}

/** 按风险等级筛选。 */
export function rulesByRisk(risk: RiskLevel): ClarityRule[] {
  return rules.filter((r) => r.risk === risk);
}

export { seedRules };
