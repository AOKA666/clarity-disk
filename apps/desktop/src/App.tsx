import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { CapacityRing } from "./components/CapacityRing";
import { ExplanationPanel } from "./components/ExplanationPanel";
import { Sidebar } from "./components/Sidebar";
import { SpaceList, type GroupMode } from "./components/SpaceList";
import { SuggestionCards } from "./components/SuggestionCards";
import {
  diskSummaryFromScan,
  explanationForItem,
  mockDiskSummary,
  rowToSpaceItem,
  suggestionCardsFromScan,
  type NavId,
  type ScanPayload,
  type ScanProgressView,
  type SpaceItem,
  type SuggestionCard,
} from "./data/homeModel";
import "./App.css";

type ScanPhase = "idle" | "scanning" | "done" | "error";

function App() {
  const [nav, setNav] = useState<NavId>("overview");
  const [mode, setMode] = useState<GroupMode>("app");
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [scanError, setScanError] = useState("");
  const [progress, setProgress] = useState<ScanProgressView | null>(null);
  const [scanResult, setScanResult] = useState<ScanPayload | null>(null);
  const [scannerNote, setScannerNote] = useState<string>("");
  const scanInFlight = useRef(false);
  const unlistenProgressRef = useRef<UnlistenFn | null>(null);

  const diskSummary = scanResult
    ? diskSummaryFromScan(scanResult)
    : mockDiskSummary;

  const byApp = useMemo(
    () => (scanResult ? scanResult.byApp.map(rowToSpaceItem) : []),
    [scanResult],
  );
  const byPurpose = useMemo(
    () => (scanResult ? scanResult.byPurpose.map(rowToSpaceItem) : []),
    [scanResult],
  );
  const unknownItems = useMemo(
    () => (scanResult ? scanResult.unknownRows.map(rowToSpaceItem) : []),
    [scanResult],
  );

  const items = useMemo(() => {
    if (mode === "app") {
      return byApp.length > 0 ? byApp : unknownItems;
    }
    return byPurpose.length > 0 ? byPurpose : unknownItems;
  }, [mode, byApp, byPurpose, unknownItems]);

  const suggestionCards = scanResult
    ? suggestionCardsFromScan(scanResult)
    : [];

  const [selectedId, setSelectedId] = useState("");
  const [explainView, setExplainView] = useState(() =>
    explanationForItem({
      id: "placeholder",
      label: "等待扫描",
      sizeGb: 0,
      path: "C:\\",
      isUnknown: true,
    }),
  );
  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedId) ?? items[0],
    [items, selectedId],
  );

  const selectItem = useCallback((item: SpaceItem) => {
    setSelectedId(item.id);
    setExplainView(explanationForItem(item));
  }, []);

  const selectFirstInMode = useCallback(
    (nextMode: GroupMode) => {
      const list =
        nextMode === "app"
          ? byApp.length > 0
            ? byApp
            : unknownItems
          : byPurpose.length > 0
            ? byPurpose
            : unknownItems;
      if (list[0]) {
        selectItem(list[0]);
      }
    },
    [byApp, byPurpose, unknownItems, selectItem],
  );

  useEffect(() => {
    if (!scanResult) return;
    selectFirstInMode(mode);
  }, [scanResult, selectFirstInMode]);

  useEffect(() => {
    invoke<string>("scanner_status")
      .then(setScannerNote)
      .catch(() => setScannerNote(""));
  }, []);

  const runScan = useCallback(async (clearPrevious: boolean) => {
    if (scanInFlight.current) return;
    scanInFlight.current = true;
    if (clearPrevious) {
      setScanResult(null);
      setSelectedId("");
      setProgress(null);
      setScanError("");
    }
    setPhase("scanning");
    try {
      const result = await invoke<ScanPayload>("start_c_scan");
      setScanResult(result);
      setPhase("done");
    } catch (err) {
      setScanError(String(err));
      setPhase("error");
    } finally {
      scanInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const unlisten = await listen<ScanProgressView>("scan-progress", (e) => {
        if (!cancelled) {
          setProgress(e.payload);
        }
      });
      if (cancelled) {
        unlisten();
        return;
      }
      unlistenProgressRef.current = unlisten;
      await runScan(false);
    })();

    return () => {
      cancelled = true;
      unlistenProgressRef.current?.();
      unlistenProgressRef.current = null;
    };
  }, [runScan]);

  const onSelectItem = (item: SpaceItem) => {
    selectItem(item);
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
    const unknown = unknownItems[0];
    if (unknown) {
      onSelectItem(unknown);
      return;
    }
    setExplainView({
      title: card.title,
      path: "C:\\",
      isUnknown: true,
      clues: ["尚未识别空间", `约 ${card.sizeGb.toFixed(1)} GB`],
    });
  };

  const rescan = () => {
    void runScan(true);
  };

  const progressLabel =
    phase === "scanning" && progress
      ? `已统计 ${progress.pathsScanned.toLocaleString()} 个文件 · ${
          progress.percent != null
            ? `${progress.percent.toFixed(0)}%`
            : `${(progress.bytesScanned / 1024 ** 3).toFixed(1)} GB`
        }`
      : phase === "error"
        ? scanError
        : scanResult
          ? `扫描完成 · ${scanResult.pathsScanned.toLocaleString()} 个文件 · 跳过 ${scanResult.skipped.length} 处无权限路径`
          : "";

  return (
    <div className="shell">
      <Sidebar active={nav} onNavigate={setNav} />
      <main className="main">
        <header className="topbar">
          <span className="muted">
            {nav === "overview" ? "总览" : navItemsLabel(nav)} ·{" "}
            {phase === "done" ? "C: 真实扫描" : "M2 只读扫描"}
          </span>
          <div className="topbar-actions">
            {scannerNote && (
              <span className="scanner-pill" title={scannerNote}>
                扫描器就绪
              </span>
            )}
            <button
              type="button"
              className="ghost-btn small"
              onClick={rescan}
              disabled={phase === "scanning"}
            >
              {phase === "scanning" ? "扫描中…" : "重新扫描 C:"}
            </button>
          </div>
        </header>
        {phase === "scanning" && (
          <div className="scan-bar" role="progressbar">
            <div
              className="scan-bar-fill"
              style={{
                width: `${progress?.percent ?? 8}%`,
              }}
            />
          </div>
        )}
        <div className="content-grid">
          <div className="primary">
            <CapacityRing
              summary={diskSummary}
              scanning={phase === "scanning"}
              scanLabel={progressLabel}
            />
            <SpaceList
              mode={mode}
              items={items}
              selectedId={selectedItem?.id ?? ""}
              onSelect={onSelectItem}
              onModeChange={(m) => {
                setMode(m);
                selectFirstInMode(m);
              }}
            />
            {suggestionCards.length > 0 && (
              <SuggestionCards
                cards={suggestionCards}
                onSelect={onSelectSuggestion}
              />
            )}
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
