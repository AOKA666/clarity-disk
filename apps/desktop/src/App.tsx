import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CapacityRing } from "./components/CapacityRing";
import { ExplanationPanel } from "./components/ExplanationPanel";
import { Sidebar } from "./components/Sidebar";
import { SpaceList, type GroupMode } from "./components/SpaceList";
import { SuggestionCards } from "./components/SuggestionCards";
import {
  byApp,
  byPurpose,
  explanationForItem,
  suggestionCards,
  type ExplanationView,
  type NavId,
  type SpaceItem,
  type SuggestionCard,
} from "./data/mockHome";
import "./App.css";

function App() {
  const [nav, setNav] = useState<NavId>("overview");
  const [mode, setMode] = useState<GroupMode>("app");
  const [selectedId, setSelectedId] = useState(byApp[0]?.id ?? "");
  const [scannerNote, setScannerNote] = useState<string>("");

  const items = mode === "app" ? byApp : byPurpose;
  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedId) ?? items[0],
    [items, selectedId],
  );

  const [explainView, setExplainView] = useState<ExplanationView>(() =>
    explanationForItem(byApp[0]),
  );

  useEffect(() => {
    if (selectedItem) {
      setExplainView(explanationForItem(selectedItem));
    }
  }, [selectedItem]);

  useEffect(() => {
    invoke<string>("scanner_status")
      .then(setScannerNote)
      .catch(() => setScannerNote(""));
  }, []);

  const onSelectItem = (item: SpaceItem) => {
    setSelectedId(item.id);
    setExplainView(explanationForItem(item));
  };

  const onSelectSuggestion = (card: SuggestionCard) => {
    if (card.ruleId) {
      const match =
        byApp.find((i) => i.ruleId === card.ruleId) ??
        byPurpose.find((i) => i.ruleId === card.ruleId);
      if (match) {
        onSelectItem(match);
        return;
      }
    }
    setExplainView({
      title: card.title,
      path: "C:\\Users\\Demo\\AppData\\Local\\UnknownVendor\\cache2",
      isUnknown: true,
      clues: [
        "目录不在规则库中",
        "体积 9.2 GB",
        "最近写入活跃",
      ],
    });
  };

  return (
    <div className="shell">
      <Sidebar active={nav} onNavigate={setNav} />
      <main className="main">
        <header className="topbar">
          <span className="muted">
            {nav === "overview" ? "总览" : navItemsLabel(nav)} · 假数据演示
          </span>
          {scannerNote && (
            <span className="scanner-pill" title={scannerNote}>
              扫描器：M2
            </span>
          )}
        </header>
        <div className="content-grid">
          <div className="primary">
            <CapacityRing />
            <SpaceList
              mode={mode}
              items={items}
              selectedId={selectedItem?.id ?? ""}
              onSelect={onSelectItem}
              onModeChange={(m) => {
                setMode(m);
                const next = m === "app" ? byApp[0] : byPurpose[0];
                if (next) onSelectItem(next);
              }}
            />
            <SuggestionCards
              cards={suggestionCards}
              onSelect={onSelectSuggestion}
            />
          </div>
          <ExplanationPanel view={explainView} />
        </div>
      </main>
    </div>
  );
}

function navItemsLabel(id: NavId): string {
  const map: Record<NavId, string> = {
    overview: "总览",
    explore: "空间探索",
    apps: "应用与文件",
    suggestions: "清理建议",
    unknown: "未知项目",
  };
  return map[id];
}

export default App;
