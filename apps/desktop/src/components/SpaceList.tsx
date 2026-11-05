import {
  bucketTier,
  partitionByBucket,
  riskTier,
  type SpaceItem,
} from "../data/homeModel";

export type GroupMode = "volume" | "app" | "purpose";

interface SpaceListProps {
  mode: GroupMode;
  items: SpaceItem[];
  selectedId: string;
  onSelect: (item: SpaceItem) => void;
  onModeChange: (mode: GroupMode) => void;
}

function rowKey(item: SpaceItem, mode: GroupMode): string {
  return `${mode}:${item.id}:${item.ruleId ?? "unknown"}:${item.path}`;
}

function ItemRows({
  rows,
  mode,
  selectedId,
  onSelect,
  muted,
  showRisk,
}: {
  rows: SpaceItem[];
  mode: GroupMode;
  selectedId: string;
  onSelect: (item: SpaceItem) => void;
  muted?: boolean;
  showRisk?: boolean;
}) {
  return (
    <ul className={`rows${muted ? " rows-muted" : ""}`}>
      {rows.map((item) => {
        const bucket = bucketTier(item.bucket);
        const tier =
          showRisk && item.risk
            ? riskTier(item.risk)
            : item.isUnknown
              ? riskTier(undefined)
              : bucket;
        return (
          <li key={rowKey(item, mode)}>
            <button
              type="button"
              className={`row${selectedId === item.id ? " selected" : ""}${
                muted ? " row-system" : ""
              }`}
              onClick={() => onSelect(item)}
            >
              <span className="row-label">{item.label}</span>
              <span className={`risk-pill row-risk ${tier.cls}`}>
                {showRisk && item.risk ? tier.text : bucket.text}
              </span>
              <span className="row-meta">{item.purpose ?? "—"}</span>
              <span className="row-size">{item.sizeGb.toFixed(1)} GB</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function SpaceList({
  mode,
  items,
  selectedId,
  onSelect,
  onModeChange,
}: SpaceListProps) {
  const { user, slim, system } = partitionByBucket(items);
  const showRisk = mode !== "volume";

  return (
    <section className="panel space-list">
      <header className="panel-head">
        <div>
          <h2>谁占用了空间</h2>
          <p className="muted">
            顶目录归因合计≈C: 已用 · 三桶分清你的文件与可瘦身 · M2.5 只读
          </p>
        </div>
        <div className="segmented">
          <button
            type="button"
            className={mode === "volume" ? "on" : ""}
            onClick={() => onModeChange("volume")}
          >
            按顶目录
          </button>
          <button
            type="button"
            className={mode === "app" ? "on" : ""}
            onClick={() => onModeChange("app")}
          >
            按应用
          </button>
          <button
            type="button"
            className={mode === "purpose" ? "on" : ""}
            onClick={() => onModeChange("purpose")}
          >
            按用途
          </button>
        </div>
      </header>
      {items.length === 0 ? (
        <p className="muted empty-hint">等待 C: 扫描结果…</p>
      ) : (
        <>
          {user.length > 0 && (
            <div className="bucket-block">
              <h3 className="bucket-head">你的文件</h3>
              <p className="muted bucket-note">
                文档 / 桌面 / 下载 / 聊天等 · 仅识别，无清理入口
              </p>
              <ItemRows
                rows={user}
                mode={mode}
                selectedId={selectedId}
                onSelect={onSelect}
                showRisk={showRisk}
              />
            </div>
          )}
          {slim.length > 0 && (
            <div className="bucket-block">
              <h3 className="bucket-head">可瘦身</h3>
              <p className="muted bucket-note">
                可重建缓存与安装残留 · 删除仍待 M4
              </p>
              <ItemRows
                rows={slim}
                mode={mode}
                selectedId={selectedId}
                onSelect={onSelect}
                showRisk={showRisk}
              />
            </div>
          )}
          {system.length > 0 && (
            <div className="bucket-block bucket-block-system">
              <h3 className="bucket-head">系统别动</h3>
              <p className="muted bucket-note">
                WinSxS / pagefile / 无权限差额等 · 禁止一键清
              </p>
              <ItemRows
                rows={system}
                mode={mode}
                selectedId={selectedId}
                onSelect={onSelect}
                muted
                showRisk={showRisk}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
