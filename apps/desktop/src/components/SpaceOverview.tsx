import {
  bucketTier,
  bytesToGb,
  isVisibleListBytes,
  riskTier,
  rowToSpaceItem,
  type ScanPayload,
  type SpaceItem,
} from "../data/homeModel";
import {
  getUsagePref,
  type UsageChoice,
  usagePrefKey,
} from "../data/usagePrefs";
import {
  buildUserVendorPersonalItems,
  sortBySizeDesc,
  vendorKeyForItem,
} from "../data/userVendorRows";

export type OverviewScreen =
  | "home"
  | "drill-system"
  | "drill-user"
  | "drill-slim";

interface SpaceOverviewProps {
  scan: ScanPayload | null;
  screen: OverviewScreen;
  selectedId: string;
  onSelect: (item: SpaceItem) => void;
  onNavigate: (screen: OverviewScreen) => void;
  usageRevision: number;
}

function SortNote() {
  return <p className="sort-note muted">按体积 ↓ 排序（大→小）</p>;
}

function DetailRows({
  rows,
  selectedId,
  onSelect,
  showRisk,
  usageRevision: _usageRevision,
}: {
  rows: SpaceItem[];
  selectedId: string;
  onSelect: (item: SpaceItem) => void;
  showRisk?: boolean;
  usageRevision?: number;
}) {
  return (
    <ul className="rows">
      {rows.map((item) => {
        const pref = getUsagePref(usagePrefKey(item));
        const tier = showRisk
          ? item.risk
            ? riskTier(item.risk)
            : riskTier(undefined)
          : pref === "unused"
            ? bucketTier("slim")
            : riskTier(undefined);
        return (
          <li key={item.id}>
            <button
              type="button"
              className={`row${selectedId === item.id ? " selected" : ""}${
                item.bucket === "system" ? " row-system" : ""
              }${pref === "unused" ? " row-slim-candidate" : ""}`}
              onClick={() => onSelect(item)}
            >
              <span className="row-label">{item.label}</span>
              {(showRisk || pref === "unused") && (
                <span className={`risk-pill row-risk ${tier.cls}`}>
                  {tier.text}
                </span>
              )}
              <span className="row-meta">{item.purpose ?? "—"}</span>
              <span className="row-size">{item.sizeGb.toFixed(1)} GB</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function HomeBlock({
  title,
  subtitle,
  sizeGb,
  tone,
  onOpen,
}: {
  title: string;
  subtitle: string;
  sizeGb: number;
  tone: "system" | "user" | "slim";
  onOpen: () => void;
}) {
  if (!isVisibleListBytes(sizeGb * 1024 ** 3)) {
    return null;
  }
  return (
    <li>
      <button type="button" className={`ia-block ia-${tone}`} onClick={onOpen}>
        <div className="ia-block-text">
          <span className="ia-title">{title}</span>
          <span className="ia-sub muted">{subtitle}</span>
        </div>
        <span className="ia-size">{sizeGb.toFixed(1)} GB</span>
        <span className="ia-chevron" aria-hidden>
          ›
        </span>
      </button>
    </li>
  );
}

function SlimSummaryRow({
  sizeGb,
  onOpen,
}: {
  sizeGb: number;
  onOpen: () => void;
}) {
  if (!isVisibleListBytes(sizeGb * 1024 ** 3)) {
    return null;
  }
  return (
    <button type="button" className="ia-slim-summary" onClick={onOpen}>
      <span>可瘦身汇总</span>
      <span className="ia-size">{sizeGb.toFixed(1)} GB</span>
      <span className="muted">缓存 / 安装残留 · M4 才进回收站 ›</span>
    </button>
  );
}

export function buildSystemDrillItems(scan: ScanPayload): SpaceItem[] {
  const tops = scan.byTopLevel
    .filter((r) => r.bucket === "system")
    .map(rowToSpaceItem);
  const apps = scan.byApp
    .filter((r) => r.bucket === "system")
    .map(rowToSpaceItem);
  const unknowns = scan.unknownRows
    .filter((r) => r.bucket === "system")
    .map(rowToSpaceItem);
  return sortBySizeDesc([...tops, ...apps, ...unknowns]);
}

export function buildSlimDrillItems(scan: ScanPayload): SpaceItem[] {
  const tops = scan.byTopLevel
    .filter((r) => r.bucket === "slim")
    .map(rowToSpaceItem);
  const apps = scan.byApp
    .filter((r) => r.bucket === "slim")
    .map(rowToSpaceItem);
  const unknowns = scan.unknownRows
    .filter((r) => r.bucket === "slim")
    .map(rowToSpaceItem);
  return sortBySizeDesc([...tops, ...apps, ...unknowns]);
}

function withUsageSlimBoost(
  slimBase: SpaceItem[],
  personal: SpaceItem[],
  _usageRevision: number,
): SpaceItem[] {
  const extra: SpaceItem[] = [];
  const seen = new Set(slimBase.map((s) => vendorKeyForItem(s)));
  for (const p of personal) {
    const key = usagePrefKey(p);
    if (getUsagePref(key) !== "unused") continue;
    if (seen.has(vendorKeyForItem(p))) continue;
    extra.push({
      ...p,
      bucket: "slim",
      risk: "confirm",
      purpose: `${p.label} · 标记为不用了（整体可瘦身候选）`,
    });
  }
  return sortBySizeDesc([...slimBase, ...extra]);
}

function filterActivePersonal(personal: SpaceItem[]): SpaceItem[] {
  return personal.filter((p) => getUsagePref(usagePrefKey(p)) !== "unused");
}

export function explanationForHomeBlock(
  kind: "system" | "user" | "slim",
  scan: ScanPayload,
) {
  const gb = bytesToGb(
    kind === "system"
      ? scan.buckets.systemBytes
      : kind === "user"
        ? scan.buckets.userBytes
        : scan.buckets.slimBytes,
  );
  const titles = {
    system: "系统文件",
    user: "用户文件",
    slim: "可瘦身汇总",
  };
  const clues =
    kind === "system"
      ? [
          `合计约 ${gb.toFixed(1)} GB`,
          "含 Windows 目录、WinSxS/pagefile 等禁止项与无权限差额",
          "点进列表查看分项；不提供删除",
        ]
      : kind === "user"
        ? [
            `合计约 ${gb.toFixed(1)} GB`,
            "按厂商/文件夹名展示；可选「还在用 / 不用了」",
            "个人内容默认不提供删除",
          ]
        : [
            `合计约 ${gb.toFixed(1)} GB`,
            "可重建缓存与安装残留；删除功能待 M4",
            "点进查看可清理候选清单",
          ];
  return {
    title: titles[kind],
    path: `${scan.drive}\\`,
    isUnknown: true,
    eyebrow: "解释卡 · 空间分区",
    clues,
  };
}

export function SpaceOverview({
  scan,
  screen,
  selectedId,
  onSelect,
  onNavigate,
  usageRevision,
}: SpaceOverviewProps) {
  if (!scan) {
    return (
      <section className="panel space-list">
        <p className="muted empty-hint">等待 C: 扫描结果…</p>
      </section>
    );
  }

  const systemGb = bytesToGb(scan.buckets.systemBytes);
  const userGb = bytesToGb(scan.buckets.userBytes);
  const slimGb = bytesToGb(scan.buckets.slimBytes);

  if (screen === "home") {
    return (
      <section className="panel space-list">
        <header className="panel-head">
          <div>
            <h2>谁占用了空间</h2>
            <p className="muted">
              系统与用户两大块 · 点进查看明细 · 顶目录归因≈C: 已用
            </p>
          </div>
        </header>
        <ul className="ia-home">
          <HomeBlock
            title="系统文件"
            subtitle="Windows、驱动、无权限差额 · 勿随意删除"
            sizeGb={systemGb}
            tone="system"
            onOpen={() => onNavigate("drill-system")}
          />
          <HomeBlock
            title="用户文件"
            subtitle="按厂商/文件夹查看占用"
            sizeGb={userGb}
            tone="user"
            onOpen={() => onNavigate("drill-user")}
          />
        </ul>
        <SlimSummaryRow
          sizeGb={slimGb}
          onOpen={() => onNavigate("drill-slim")}
        />
      </section>
    );
  }

  const titles: Record<Exclude<OverviewScreen, "home">, string> = {
    "drill-system": "系统文件",
    "drill-user": "用户文件",
    "drill-slim": "可瘦身",
  };

  const systemRows = buildSystemDrillItems(scan);
  const personalAll = buildUserVendorPersonalItems(scan);
  const personalRows = filterActivePersonal(personalAll);
  const slimBase = buildSlimDrillItems(scan);
  const slimRows = withUsageSlimBoost(slimBase, personalAll, usageRevision);

  return (
    <section className="panel space-list">
      <header className="panel-head drill-head">
        <button
          type="button"
          className="ghost-btn small back-btn"
          onClick={() => onNavigate("home")}
        >
          ← 返回总览
        </button>
        <h2>{titles[screen]}</h2>
        <p className="muted">
          {screen === "drill-slim"
            ? "仅展示可瘦身候选 · 风险标签 · M4 才进回收站"
            : screen === "drill-user"
              ? "上：厂商/文件夹 · 下：可清理候选（含标记「不用了」项）"
              : "系统相关分项 · 仅调查"}
        </p>
      </header>

      {screen === "drill-system" && (
        <>
          <SortNote />
          {systemRows.length === 0 ? (
            <p className="muted empty-hint">暂无可见系统分项</p>
          ) : (
            <DetailRows
              rows={systemRows}
              selectedId={selectedId}
              onSelect={onSelect}
              showRisk
              usageRevision={usageRevision}
            />
          )}
        </>
      )}

      {screen === "drill-user" && (
        <>
          <h3 className="drill-section-head">个人与应用数据</h3>
          <p className="muted drill-section-note">
            厂商/文件夹名 · 请在右侧选择「还在用 / 不用了」
          </p>
          <SortNote />
          {personalRows.length === 0 ? (
            <p className="muted empty-hint">暂无可见分项</p>
          ) : (
            <DetailRows
              rows={personalRows}
              selectedId={selectedId}
              onSelect={onSelect}
              usageRevision={usageRevision}
            />
          )}
          <h3 className="drill-section-head">可清理候选</h3>
          <p className="muted drill-section-note">
            缓存 / 安装残留 · 显示风险等级
          </p>
          <SortNote />
          {slimRows.length === 0 ? (
            <p className="muted empty-hint">暂无可瘦身候选</p>
          ) : (
            <DetailRows
              rows={slimRows}
              selectedId={selectedId}
              onSelect={onSelect}
              showRisk
              usageRevision={usageRevision}
            />
          )}
        </>
      )}

      {screen === "drill-slim" && (
        <>
          <SortNote />
          {slimRows.length === 0 ? (
            <p className="muted empty-hint">暂无可瘦身候选</p>
          ) : (
            <DetailRows
              rows={slimRows}
              selectedId={selectedId}
              onSelect={onSelect}
              showRisk
              usageRevision={usageRevision}
            />
          )}
        </>
      )}
    </section>
  );
}

export function isUserUsageEligible(item: SpaceItem): boolean {
  return (
    item.bucket === "user" &&
    (Boolean(item.unknownGroup) ||
      item.id.startsWith("vendor-") ||
      Boolean(item.ruleId))
  );
}

export { type UsageChoice };
