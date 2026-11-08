# Clarity Disk

解释式 C 盘空间助手：**扫描 → 归类 → 解释 → 安全清理**。规则库决定能否删除；AI 只负责解释，永不触发删除。

## 仓库结构

| 路径 | 说明 |
|------|------|
| `apps/desktop` | Tauri 2 + React + TypeScript 桌面壳 |
| `crates/scanner` | Rust C: 只读扫描（Windows 真机；非 Windows 为 stub） |
| `packages/rules` | 规则 JSON Schema、种子规则、`matchRuleForPath` 等匹配辅助 |

## 快速开始（Windows 验收 M2.5）

```bash
pnpm install
pnpm tauri dev
```

应用启动后会**自动开始只读扫描 C:**；也可点击右上角 **「重新扫描 C:」**。扫描过程中顶部有进度条与文件计数。

> **需要 Windows 10/11 真机** 才能验证 C: 扫描。Linux/macOS 上 `cargo test -p scanner`，但 Tauri 桌面需本机 GUI 环境。

## M2.5 范围（当前）

- **顶目录归因**：`Users` / `Windows` / `Program Files` 等汇总，列表合计接近 C: 已用；差额在 Hero 与「无权限 / 未遍历」行说明
- **首页 IA**：仅「系统文件」「用户文件」两大块 +「可瘦身汇总」；点进钻取明细（无按目录/应用/用途切换）
- **三桶数据**：后台仍分 user / slim / system，驱动钻取列表与 Hero
- **规则库 ≥50 条**（当前种子 **135** 条，含 `windows.old`、剪映 JianyingPro 等）；每条含 `bucket` 字段
- **尚未识别粗分组**：未命中规则按 AppData/Program Files 等父目录拆成多行（≥0.05 GiB）
- **无任何删除或回收站路径**（清理为 M4）

## M2 基础（已包含）

- `crates/scanner`：遍历 C: 卷内文件（只读），进度事件，无权限目录写入 `skipped`
- 与 `packages/rules` 匹配；未命中归入 **「尚未识别」**
- 按顶目录 / `ownerApp` / `purpose` 聚合体积

## 安全原则

1. **规则决定删除** — 每条路径命中规则的 `risk` 字段（`safe` / `confirm` / `forbidden`）
2. **AI 永不删除** — 模型仅可生成解释文案
3. **未知无删除** — 未匹配规则归入调查模式，不提供删除操作
4. **回收站唯一** — 产品内清理只通过 IFileOperation 进回收站，不做永久删除（M4）

## 里程碑

- **M1** · 脚手架 + 假数据首页
- **M2** · 真实 C: 只读扫描 + UI 接真数据
- **M2.5** · 顶目录归因 + 三桶 + 规则 ≥50（本里程碑）
- **M3** · 规则 ≥100 + 解释卡深化
- **M4** · 安全清理 + Windows 真机验收

## 许可证

私有产品仓库 — 使用前请与维护者确认。
