import type { BucketKind, RiskLevel } from "@clarity/rules";

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
  bucket?: BucketKind;
  isUnknown?: boolean;
}

export interface SuggestionCard {
  id: string;
  title: string;
  subtitle: string;
  sizeGb: number;
  risk: RiskLevel;
  bucket?: BucketKind;
  ruleId?: string;
}

export interface DiskSummary {
  drive: string;
  totalGb: number;
  usedGb: number;
  freeGb: number;
  reclaimableGb: number;
  matchedGb?: number;
  attributedGb?: number;
  permissionGapGb?: number;
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
  attributedBytes: number;
  permissionGapBytes: number;
  unexplainedBytes: number;
  skipped: { path: string; reason: string }[];
  byTopLevel: ScanRow[];
  byApp: ScanRow[];
  byPurpose: ScanRow[];
  unknownRows: ScanRow[];
  suggestions: {
    safeBytes: number;
    confirmBytes: number;
    unknownBytes: number;
  };
  buckets: {
    userBytes: number;
    slimBytes: number;
    systemBytes: number;
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
  bucket?: BucketKind;
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

export function bucketTier(bucket?: BucketKind): {
  text: string;
  cls: "bucket-user" | "bucket-slim" | "bucket-system" | "risk-unknown";
} {
  if (bucket === "user") {
    return { text: "你的文件", cls: "bucket-user" };
  }
  if (bucket === "slim") {
    return { text: "可瘦身", cls: "bucket-slim" };
  }
  if (bucket === "system") {
    return { text: "系统别动", cls: "bucket-system" };
  }
  return { text: "待归类", cls: "risk-unknown" };
}

export type SpaceBucket = BucketKind;

/** 三桶分区：你的文件 / 可瘦身 / 系统别动 */
export function partitionByBucket(items: SpaceItem[]): {
  user: SpaceItem[];
  slim: SpaceItem[];
  system: SpaceItem[];
} {
  const user: SpaceItem[] = [];
  const slim: SpaceItem[] = [];
  const system: SpaceItem[] = [];
  for (const item of items) {
    const b =
      item.bucket ??
      (item.risk === "forbidden"
        ? "system"
        : item.isUnknown
          ? "user"
          : "slim");
    if (b === "system") {
      system.push(item);
    } else if (b === "slim") {
      slim.push(item);
    } else {
      user.push(item);
    }
  }
  return { user, slim, system };
}

/** @deprecated 保留兼容；新 UI 使用 partitionByBucket */
export function partitionSpaceItems(items: SpaceItem[]): {
  primary: SpaceItem[];
  system: SpaceItem[];
} {
  const { user, slim, system } = partitionByBucket(items);
  return { primary: [...user, ...slim], system };
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
    bucket: row.bucket,
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
    attributedGb: bytesToGb(scan.attributedBytes),
    permissionGapGb: bytesToGb(scan.permissionGapBytes),
    unknownGb: bytesToGb(scan.suggestions.unknownBytes),
    unexplainedGb: bytesToGb(scan.unexplainedBytes),
    localOnly: true,
  };
}

export function permissionGapSpaceItem(scan: ScanPayload): SpaceItem | null {
  if (!isVisibleListBytes(scan.permissionGapBytes)) {
    return null;
  }
  return {
    id: "permission-gap",
    label: "无权限 / 未遍历",
    sizeGb: bytesToGb(scan.permissionGapBytes),
    path: `${scan.drive}\\`,
    isUnknown: true,
    bucket: "system",
    purpose: "跳过目录内体积与元数据",
  };
}

export function buildSpaceListItems(
  scan: ScanPayload,
  mode: "volume" | "app" | "purpose",
): SpaceItem[] {
  const source =
    mode === "volume"
      ? scan.byTopLevel
      : mode === "app"
        ? scan.byApp
        : scan.byPurpose;

  const main = source.filter(isVisibleListRow).map(rowToSpaceItem);

  if (mode === "volume") {
    return main;
  }

  const extras: SpaceItem[] = [];
  for (const row of scan.unknownRows.filter(isVisibleListRow)) {
    extras.push(rowToSpaceItem(row));
  }
  const gap = permissionGapSpaceItem(scan);
  if (gap) {
    extras.push(gap);
  }
  if (main.length === 0 && extras.length > 0) {
    return extras;
  }
  return [...main, ...extras];
}

export function explanationForPermissionGap(scan: ScanPayload): ExplanationView {
  const used = bytesToGb(scan.usedBytes).toFixed(1);
  const walked = bytesToGb(scan.bytesScanned).toFixed(1);
  const gap = bytesToGb(scan.permissionGapBytes).toFixed(1);
  return {
    title: "无权限 / 未遍历",
    path: `${scan.drive}\\`,
    isUnknown: true,
    eyebrow: "解释卡 · 空间差额",
    clues: [
      `C: 已用 ${used} GB（总容量 − 可用空间）`,
      `本次可读文件合计 ${walked} GB · 差额 ${gap} GB`,
      `无权限跳过 ${scan.skipped.length} 处目录（列表见扫描完成提示）`,
      "差额主要为：System Volume Information、其他用户/profile、被锁目录内体积等",
      "顶级目录归因行合计应接近 C: 已用；剩余差额即此项",
      "M2.5 只读 · 无删除操作",
    ],
  };
}

export function explanationForOtherGap(scan: ScanPayload): ExplanationView {
  return explanationForPermissionGap(scan);
}

export function suggestionCardsFromScan(scan: ScanPayload): SuggestionCard[] {
  const cards: SuggestionCard[] = [
    {
      id: "b-user",
      title: "你的文件",
      subtitle: "文档/桌面/下载/聊天等 · 仅识别占用，不提供清理",
      sizeGb: bytesToGb(scan.buckets.userBytes),
      risk: "confirm",
      bucket: "user",
    },
    {
      id: "b-slim",
      title: "可瘦身",
      subtitle: "可重建缓存与安装残留 · M4 才进回收站",
      sizeGb: bytesToGb(scan.buckets.slimBytes),
      risk: "safe",
      bucket: "slim",
    },
    {
      id: "b-system",
      title: "系统别动",
      subtitle: "WinSxS / 页面文件 / 无权限差额等",
      sizeGb: bytesToGb(scan.buckets.systemBytes),
      risk: "forbidden",
      bucket: "system",
    },
  ];
  return cards.filter((c) => isVisibleListBytes(c.sizeGb * 1024 ** 3));
}

export function explanationForItem(
  item: SpaceItem,
  scan?: ScanPayload | null,
): ExplanationView {
  if (
    (item.id === "permission-gap" || item.id === "vol-permission-gap") &&
    scan
  ) {
    return explanationForPermissionGap(scan);
  }
  if (item.isUnknown || !item.ruleId) {
    const bucketNote =
      item.bucket === "user"
        ? "归入「你的文件」桶 · 不提供清理按钮"
        : item.bucket === "system"
          ? "归入「系统别动」桶 · 仅调查"
          : undefined;
    return {
      title: item.label,
      path: item.path,
      isUnknown: true,
      clues: [
        bucketNote ?? "目录不在规则库或未细分类",
        `体积约 ${item.sizeGb.toFixed(1)} GB`,
        item.purpose ?? "来源需结合路径判断",
        "产品策略：未知与用户文件项不提供删除",
      ].filter(Boolean) as string[],
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

export const mockByApp: SpaceItem[] = [];

export const mockByPurpose: SpaceItem[] = [];

export const mockSuggestionCards: SuggestionCard[] = [];
