import type { SpaceItem } from "../data/mockHome";

export type GroupMode = "app" | "purpose";

interface SpaceListProps {
  mode: GroupMode;
  items: SpaceItem[];
  selectedId: string;
  onSelect: (item: SpaceItem) => void;
  onModeChange: (mode: GroupMode) => void;
}

export function SpaceList({
  mode,
  items,
  selectedId,
  onSelect,
  onModeChange,
}: SpaceListProps) {
  return (
    <section className="panel space-list">
      <header className="panel-head">
        <div>
          <h2>谁占用了空间</h2>
          <p className="muted">点击条目查看右侧解释卡</p>
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
      <ul className="rows">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={`row${selectedId === item.id ? " selected" : ""}`}
              onClick={() => onSelect(item)}
            >
              <span className="row-label">{item.label}</span>
              <span className="row-meta">{item.purpose ?? "—"}</span>
              <span className="row-size">{item.sizeGb.toFixed(1)} GB</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
