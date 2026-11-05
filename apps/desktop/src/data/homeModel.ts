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
  localOnly: true;
}

export interface ExplanationView {
  title: string;
  path: string;
  ruleId?: string;
  isUnknown: boolean;
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
    localOnly: true,
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
  return cards.filter((c) => c.sizeGb > 0.05);
}

export function explanationForItem(item: SpaceItem): ExplanationView {
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
