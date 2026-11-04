# Clarity Disk

解释式 C 盘空间助手：**扫描 → 归类 → 解释 → 安全清理**。规则库决定能否删除；AI 只负责解释，永不触发删除。

## 仓库结构

| 路径 | 说明 |
|------|------|
| `apps/desktop` | Tauri 2 + React + TypeScript 桌面壳（M1 假数据首页） |
| `crates/scanner` | Rust 扫描器占位（M2：Windows C: 只读扫描） |
| `packages/rules` | 规则 JSON Schema、种子规则、`matchRuleForPath` 等匹配辅助 |

## 快速开始

```bash
pnpm install
cd apps/desktop
pnpm tauri dev
```

或在仓库根目录：

```bash
pnpm install
pnpm tauri dev
```

> **M2 起需要 Windows 10/11 真机** 才能验证 C: 扫描与清理。Linux/macOS 可跑 M1 UI，但无法替代 Windows 磁盘行为验收。

## M1 范围（当前）

- Linear 风格中文假数据首页：侧栏、容量环、按应用/按用途、右侧四问解释卡、三张「值得关注」建议卡
- 本地规则种子约 20 条（`packages/rules/rules.seed.json`）
- 未知项：无删除按钮；安全项清理仅进回收站（M4 实现）

## 安全原则

1. **规则决定删除** — 每条路径命中规则的 `risk` 字段（`safe` / `confirm` / `forbidden`）
2. **AI 永不删除** — 模型仅可生成解释文案
3. **未知无删除** — 未匹配规则归入调查模式，不提供删除操作
4. **回收站唯一** — 产品内清理只通过 IFileOperation 进回收站，不做永久删除

## 里程碑

- **M1** · 脚手架 + 假数据首页（本提交）
- **M2** · 真实 C: 扫描（`crates/scanner`）
- **M3** · 规则 ≥100 + 解释卡接真数据
- **M4** · 安全清理 + Windows 真机验收

## 许可证

私有产品仓库 — 使用前请与维护者确认。
