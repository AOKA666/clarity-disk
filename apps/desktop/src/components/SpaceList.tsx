import {
  partitionSpaceItems,
  riskTier,
  type SpaceItem,
} from "../data/homeModel";

export type GroupMode = "app" | "purpose";

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
}: {
  rows: SpaceItem[];
  mode: GroupMode;
  selectedId: string;
  onSelect: (item: SpaceItem) => void;
  muted?: boolean;
}) {
  return (
    <ul className={`rows${muted ? " rows-muted" : ""}`}>
      {rows.map((item) => {
        const tier = item.isUnknown ? riskTier(undefined) : riskTier(item.risk);
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
              <span className={`risk-pill row-risk ${tier.cls}`}>{tier.text}</span>
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
  const { primary, system } = partitionSpaceItems(items);

  return (
    <section className="panel space-list">
      <header className="panel-head">
        <div>
          <h2>谁占用了空间</h2>
          <p className="muted">
            标签表示日后清理风险 · M2 只读，无删除按钮
          </p>
        </div>
        <div className="segmented">
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
          <ItemRows
            rows={primary}
            mode={mode}
            selectedId={selectedId}
            onSelect={onSelect}
          />
          {system.length > 0 && (
            <div className="system-block">
              <h3 className="system-head">系统相关 · 禁止直接清</h3>
              <p className="muted system-note">
                WinSxS / pagefile / hiberfil 等 · 仅解释与调查，M2 不提供删除
              </p>
              <ItemRows
                rows={system}
                mode={mode}
                selectedId={selectedId}
                onSelect={onSelect}
                muted
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
