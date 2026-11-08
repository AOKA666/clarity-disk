import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { CapacityRing } from "./components/CapacityRing";
import { ExplanationPanel } from "./components/ExplanationPanel";
import { Sidebar } from "./components/Sidebar";
import {
  SpaceOverview,
  type OverviewScreen,
  buildSlimDrillItems,
  buildSystemDrillItems,
  buildUserPersonalItems,
  explanationForHomeBlock,
} from "./components/SpaceOverview";
import {
  diskSummaryFromScan,
  explanationForItem,
  mockDiskSummary,
  type NavId,
  type ScanPayload,
  type ScanProgressView,
  type SpaceItem,
} from "./data/homeModel";
import "./App.css";

type ScanPhase = "idle" | "scanning" | "done" | "error";

function drillItems(scan: ScanPayload, screen: OverviewScreen): SpaceItem[] {
  if (screen === "drill-system") return buildSystemDrillItems(scan);
  if (screen === "drill-slim") return buildSlimDrillItems(scan);
  if (screen === "drill-user") {
    return [...buildUserPersonalItems(scan), ...buildSlimDrillItems(scan)];
  }
  return [];
}

function App() {
  const [nav, setNav] = useState<NavId>("overview");
  const [screen, setScreen] = useState<OverviewScreen>("home");
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

  const selectItem = useCallback(
    (item: SpaceItem) => {
      setSelectedId(item.id);
      setExplainView(explanationForItem(item, scanResult));
    },
    [scanResult],
  );

  const onNavigate = useCallback(
    (next: OverviewScreen) => {
      setScreen(next);
      if (!scanResult) return;
      if (next === "home") {
        setSelectedId("");
        setExplainView(
          explanationForItem({
            id: "home-hint",
            label: "谁占用了空间",
            sizeGb: 0,
            path: `${scanResult.drive}\\`,
            isUnknown: true,
            clues: [
              "点选「系统文件」或「用户文件」查看分项",
              "「可瘦身汇总」直达可清理候选",
              "M2.5 只读 · 无删除",
            ],
          }),
        );
        return;
      }
      const items = drillItems(scanResult, next);
      if (items[0]) {
        selectItem(items[0]);
      } else if (next === "drill-system") {
        setExplainView(explanationForHomeBlock("system", scanResult));
      } else if (next === "drill-user") {
        setExplainView(explanationForHomeBlock("user", scanResult));
      } else {
        setExplainView(explanationForHomeBlock("slim", scanResult));
      }
    },
    [scanResult, selectItem],
  );

  useEffect(() => {
    if (!scanResult) return;
    setScreen("home");
    setSelectedId("");
    setExplainView(
      explanationForItem({
        id: "home-hint",
        label: "谁占用了空间",
        sizeGb: diskSummaryFromScan(scanResult).usedGb,
        path: `${scanResult.drive}\\`,
        isUnknown: true,
        clues: [
          `C: 已用约 ${diskSummaryFromScan(scanResult).usedGb.toFixed(1)} GB`,
          "首页仅「系统文件」「用户文件」两大块 + 可瘦身汇总",
          "点进用户文件可分别查看个人占用与可清理候选",
        ],
      }),
    );
  }, [scanResult]);

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
      setScreen("home");
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
            {phase === "done" ? "C: 真实扫描 · M2.5" : "M2.5 只读扫描"}
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
            <SpaceOverview
              scan={scanResult}
              screen={screen}
              selectedId={selectedId}
              onSelect={selectItem}
              onNavigate={onNavigate}
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
