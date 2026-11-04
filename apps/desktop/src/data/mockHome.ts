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
}

export interface SuggestionCard {
  id: string;
  title: string;
  subtitle: string;
  sizeGb: number;
  risk: RiskLevel;
  ruleId?: string;
}

export const diskSummary = {
  drive: "C:",
  totalGb: 512,
  usedGb: 421,
  reclaimableGb: 38.6,
  localOnly: true,
};

export const navItems: { id: NavId; label: string; badge?: number }[] = [
  { id: "overview", label: "总览" },
  { id: "explore", label: "空间探索" },
  { id: "apps", label: "应用与文件" },
  { id: "suggestions", label: "清理建议" },
  { id: "unknown", label: "未知项目", badge: 4 },
];

export const byApp: SpaceItem[] = [
  {
    id: "wechat",
    label: "微信",
    sizeGb: 48.2,
    path: "C:\\Users\\Demo\\Documents\\WeChat Files",
    ruleId: "wechat-files",
    purpose: "聊天与文件",
  },
  {
    id: "chrome",
    label: "Google Chrome",
    sizeGb: 12.4,
    path: "C:\\Users\\Demo\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cache",
    ruleId: "chrome-cache",
    purpose: "浏览器缓存",
  },
  {
    id: "steam",
    label: "Steam",
    sizeGb: 96.8,
    path: "C:\\Program Files (x86)\\Steam\\steamapps",
    ruleId: "steam-shadercache",
    purpose: "游戏与缓存",
  },
  {
    id: "edge",
    label: "Microsoft Edge",
    sizeGb: 6.1,
    path: "C:\\Users\\Demo\\AppData\\Local\\Microsoft\\Edge\\User Data\\Default\\Cache",
    ruleId: "edge-cache",
    purpose: "浏览器缓存",
  },
  {
    id: "docker",
    label: "Docker Desktop",
    sizeGb: 34.5,
    path: "C:\\ProgramData\\Docker",
    ruleId: "docker-data",
    purpose: "容器镜像",
  },
  {
    id: "downloads",
    label: "下载文件夹",
    sizeGb: 22.3,
    path: "C:\\Users\\Demo\\Downloads",
    ruleId: "downloads",
    purpose: "用户下载",
  },
];

export const byPurpose: SpaceItem[] = [
  {
    id: "p-cache",
    label: "应用缓存",
    sizeGb: 41.2,
    path: "C:\\Users\\Demo\\AppData\\Local\\Temp",
    ruleId: "user-temp",
    purpose: "缓存",
  },
  {
    id: "p-chat",
    label: "聊天与社交",
    sizeGb: 52.7,
    path: "C:\\Users\\Demo\\Documents\\WeChat Files",
    ruleId: "wechat-files",
    purpose: "社交",
  },
  {
    id: "p-games",
    label: "游戏资源",
    sizeGb: 102.4,
    path: "C:\\Program Files (x86)\\Steam",
    ruleId: "steam-downloads",
    purpose: "游戏",
  },
  {
    id: "p-dev",
    label: "开发依赖",
    sizeGb: 18.9,
    path: "C:\\Projects\\demo\\node_modules",
    ruleId: "node-modules",
    purpose: "开发",
  },
  {
    id: "p-system",
    label: "系统组件",
    sizeGb: 14.6,
    path: "C:\\Windows\\WinSxS",
    ruleId: "winsxs",
    purpose: "系统",
  },
  {
    id: "p-downloads",
    label: "下载与安装包",
    sizeGb: 22.3,
    path: "C:\\Users\\Demo\\Downloads",
    ruleId: "downloads",
    purpose: "下载",
  },
];

export const suggestionCards: SuggestionCard[] = [
  {
    id: "s-safe",
    title: "可清理",
    subtitle: "过期缓存与 Temp，预览后进回收站",
    sizeGb: 11.8,
    risk: "safe",
    ruleId: "user-temp",
  },
  {
    id: "s-confirm",
    title: "需确认",
    subtitle: "下载文件夹与大聊天缓存，逐项决定",
    sizeGb: 24.6,
    risk: "confirm",
    ruleId: "downloads",
  },
  {
    id: "s-investigate",
    title: "待调查",
    subtitle: "尚未识别目录，只提供线索、不提供删除",
    sizeGb: 9.2,
    risk: "forbidden",
  },
];

export interface ExplanationView {
  title: string;
  path: string;
  ruleId?: string;
  isUnknown: boolean;
  clues?: string[];
}

export function explanationForItem(item: SpaceItem): ExplanationView {
  if (item.ruleId) {
    return {
      title: item.label,
      path: item.path,
      ruleId: item.ruleId,
      isUnknown: false,
    };
  }
  return {
    title: item.label,
    path: item.path,
    isUnknown: true,
    clues: [
      "修改时间集中在最近 30 天",
      "无有效数字签名",
      "扩展名以 .dat / .bin 为主",
    ],
  };
}
