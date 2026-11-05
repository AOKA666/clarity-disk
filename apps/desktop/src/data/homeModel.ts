import type { RiskLevel } from "@clarity/rules";

export type NavId =
  | "overview"
  | "explore"
  | "apps"
  | "suggestions"
  | "unknown";

export interface SpaceItem {
  id: string;
  label: string;
  sizeGb: number;
  path: string;
  ruleId?: string;
  purpose?: string;
  risk?: RiskLevel;
  isUnknown?: boolean;
}

export interface SuggestionCard {
  id: string;
  title: string;
  subtitle: string;
  sizeGb: number;
  risk: RiskLevel;
  ruleId?: string;
}

export interface DiskSummary {
  drive: string;
  totalGb: number;
  usedGb: number;
  freeGb: number;
  reclaimableGb: number;
  matchedGb?: number;
  unknownGb?: number;
  unexplainedGb?: number;
  localOnly: true;
}

export interface ExplanationView {
  title: string;
  path: string;
  ruleId?: string;
  isUnknown: boolean;
  eyebrow?: string;
  clues?: string[];
}

export interface ScanProgressView {
  bytesScanned: number;
  pathsScanned: number;
  currentPath: string;
  percent?: number;
}

export interface ScanPayload {
  drive: string;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  bytesScanned: number;
  pathsScanned: number;
  matchedBytes: number;
  unexplainedBytes: number;
  skipped: { path: string; reason: string }[];
  byApp: ScanRow[];
  byPurpose: ScanRow[];
  unknownRows: ScanRow[];
  suggestions: {
    safeBytes: number;
    confirmBytes: number;
    unknownBytes: number;
  };
}

export interface ScanRow {
  id: string;
  label: string;
  sizeBytes: number;
  path: string;
  ruleId?: string;
  purpose?: string;
  risk?: RiskLevel;
  isUnknown: boolean;
}

export const navItems: { id: NavId; label: string; badge?: number }[] = [
  { id: "overview", label: "总览" },
  { id: "explore", label: "空间探索" },
  { id: "apps", label: "应用与文件" },
  { id: "suggestions", label: "清理建议" },
  { id: "unknown", label: "未知项目" },
];

export function bytesToGb(bytes: number): number {
  return bytes / 1024 ** 3;
}

/** 与列表 toFixed(1) GB 显示一致：0 或显示为 0.0 GB 的不展示。 */
export const MIN_LIST_BYTES = 53_687_091;

export function isVisibleListBytes(sizeBytes: number): boolean {
  return sizeBytes >= MIN_LIST_BYTES;
}

export function isVisibleListRow(row: ScanRow): boolean {
  return isVisibleListBytes(row.sizeBytes);
}

export function riskTier(risk?: RiskLevel): {
  text: string;
  cls: "risk-safe" | "risk-confirm" | "risk-forbidden" | "risk-unknown";
} {
  if (risk === "safe") {
    return { text: "安全清理", cls: "risk-safe" };
  }
  if (risk === "confirm") {
    return { text: "需确认", cls: "risk-confirm" };
  }
  if (risk === "forbidden") {
    return { text: "禁止直接清", cls: "risk-forbidden" };
  }
  return { text: "待调查", cls: "risk-unknown" };
}

/** 主列表 vs 系统相关（forbidden），默认不把禁止项放进可操作主区域。 */
export function partitionSpaceItems(items: SpaceItem[]): {
  primary: SpaceItem[];
  system: SpaceItem[];
} {
  const primary: SpaceItem[] = [];
  const system: SpaceItem[] = [];
  for (const item of items) {
    if (!item.isUnknown && item.risk === "forbidden") {
      system.push(item);
    } else {
      primary.push(item);
    }
  }
  return { primary, system };
}

export function rowToSpaceItem(row: ScanRow): SpaceItem {
  return {
    id: row.id,
    label: row.label,
    sizeGb: bytesToGb(row.sizeBytes),
    path: row.path,
    ruleId: row.ruleId,
    purpose: row.purpose,
    risk: row.risk,
    isUnknown: row.isUnknown,
  };
}

export function diskSummaryFromScan(scan: ScanPayload): DiskSummary {
  const reclaimableGb = bytesToGb(scan.suggestions.safeBytes);
  return {
    drive: scan.drive,
    totalGb: bytesToGb(scan.totalBytes),
    usedGb: bytesToGb(scan.usedBytes),
    freeGb: bytesToGb(scan.freeBytes),
    reclaimableGb,
    matchedGb: bytesToGb(scan.matchedBytes),
    unknownGb: bytesToGb(scan.suggestions.unknownBytes),
    unexplainedGb: bytesToGb(scan.unexplainedBytes),
    localOnly: true,
  };
}

export function otherGapSpaceItem(scan: ScanPayload): SpaceItem | null {
  if (!isVisibleListBytes(scan.unexplainedBytes)) {
    return null;
  }
  return {
    id: "other-unattributed",
    label: "其他占用",
    sizeGb: bytesToGb(scan.unexplainedBytes),
    path: `${scan.drive}\\`,
    isUnknown: true,
    purpose: "差额 / 未扫描",
  };
}

export function buildSpaceListItems(
  scan: ScanPayload,
  mode: "app" | "purpose",
): SpaceItem[] {
  const main = (mode === "app" ? scan.byApp : scan.byPurpose)
    .filter(isVisibleListRow)
    .map(rowToSpaceItem);
  const extras: SpaceItem[] = [];
  for (const row of scan.unknownRows.filter(isVisibleListRow)) {
    extras.push(rowToSpaceItem(row));
  }
  const gap = otherGapSpaceItem(scan);
  if (gap) {
    extras.push(gap);
  }
  if (main.length === 0 && extras.length > 0) {
    return extras;
  }
  return [...main, ...extras];
}

export function explanationForOtherGap(scan: ScanPayload): ExplanationView {
  const used = bytesToGb(scan.usedBytes).toFixed(1);
  const matched = bytesToGb(scan.matchedBytes).toFixed(1);
  const unknown = bytesToGb(scan.suggestions.unknownBytes).toFixed(1);
  const gap = bytesToGb(scan.unexplainedBytes).toFixed(1);
  return {
    title: "其他占用",
    path: `${scan.drive}\\`,
    isUnknown: true,
    eyebrow: "解释卡 · 空间差额",
    clues: [
      `C: 已用 ${used} GB（总容量 − 可用空间）`,
      `规则命中合计 ${matched} GB · 尚未识别 ${unknown} GB · 差额 ${gap} GB`,
      `本次 walk 统计 ${scan.pathsScanned.toLocaleString()} 个文件；无权限跳过 ${scan.skipped.length} 处目录`,
      "差额常见原因：未匹配路径、跳过目录内体积、硬链接重复统计差、系统保留/元数据等",
      "「谁占用了空间」主列表仅为规则命中聚合，不等于整盘已用空间",
      "M2 只读 · 无删除操作",
    ],
  };
}

export function suggestionCardsFromScan(scan: ScanPayload): SuggestionCard[] {
  const cards: SuggestionCard[] = [
    {
      id: "s-safe",
      title: "可清理",
      subtitle: "命中 safe 规则的文件合计（M2 只读，不进回收站）",
      sizeGb: bytesToGb(scan.suggestions.safeBytes),
      risk: "safe",
      ruleId: "user-temp",
    },
    {
      id: "s-confirm",
      title: "需确认",
      subtitle: "下载、聊天数据等 confirm 规则占用",
      sizeGb: bytesToGb(scan.suggestions.confirmBytes),
      risk: "confirm",
      ruleId: "downloads",
    },
    {
      id: "s-investigate",
      title: "待调查",
      subtitle: "尚未识别 · 只提供线索、不提供删除",
      sizeGb: bytesToGb(scan.suggestions.unknownBytes),
      risk: "forbidden",
    },
  ];
  return cards.filter((c) => isVisibleListBytes(c.sizeGb * 1024 ** 3));
}

export function explanationForItem(
  item: SpaceItem,
  scan?: ScanPayload | null,
): ExplanationView {
  if (item.id === "other-unattributed" && scan) {
    return explanationForOtherGap(scan);
  }
  if (item.isUnknown || !item.ruleId) {
    return {
      title: item.label,
      path: item.path,
      isUnknown: true,
      clues: [
        "目录不在规则库中",
        `体积约 ${item.sizeGb.toFixed(1)} GB`,
        "产品策略：未知项不提供删除按钮",
      ],
    };
  }
  return {
    title: item.label,
    path: item.path,
    ruleId: item.ruleId,
    isUnknown: false,
  };
}

/** M1 假数据 — 扫描完成前不使用。 */
export const mockDiskSummary: DiskSummary = {
  drive: "C:",
  totalGb: 512,
  usedGb: 421,
  freeGb: 91,
  reclaimableGb: 38.6,
  localOnly: true,
};

export const mockByApp: SpaceItem[] = [
  {
    id: "wechat",
    label: "微信",
    sizeGb: 48.2,
    path: "C:\\Users\\Demo\\Documents\\WeChat Files",
    ruleId: "wechat-files",
    purpose: "聊天与文件",
  },
];

export const mockByPurpose: SpaceItem[] = [
  {
    id: "p-cache",
    label: "应用缓存",
    sizeGb: 41.2,
    path: "C:\\Users\\Demo\\AppData\\Local\\Temp",
    ruleId: "user-temp",
    purpose: "缓存",
  },
];

export const mockSuggestionCards: SuggestionCard[] = [
  {
    id: "s-safe",
    title: "可清理",
    subtitle: "过期缓存与 Temp，预览后进回收站",
    sizeGb: 11.8,
    risk: "safe",
    ruleId: "user-temp",
  },
];
