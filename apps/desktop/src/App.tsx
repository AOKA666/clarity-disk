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
  explanationForHomeBlock,
  isUserUsageEligible,
} from "./components/SpaceOverview";
import {
  diskSummaryFromScan,
  explanationForItem,
  mockDiskSummary,
  type ExplanationView,
  type NavId,
  type ScanPayload,
  type ScanProgressView,
  type SpaceItem,
} from "./data/homeModel";
import {
  getUsagePref,
  setUsagePref,
  usagePrefKey,
  type UsageChoice,
} from "./data/usagePrefs";
import {
  buildUserVendorPersonalItems,
  slimCacheHintsForUserItem,
} from "./data/userVendorRows";
import "./App.css";

type ScanPhase = "idle" | "scanning" | "done" | "error";

function drillItems(scan: ScanPayload, screen: OverviewScreen): SpaceItem[] {
  if (screen === "drill-system") return buildSystemDrillItems(scan);
  if (screen === "drill-slim") return buildSlimDrillItems(scan);
  if (screen === "drill-user") {
    return [
      ...buildUserVendorPersonalItems(scan),
      ...buildSlimDrillItems(scan),
    ];
  }
  return [];
}

function enrichExplanation(
  item: SpaceItem,
  base: ExplanationView,
  scan: ScanPayload | null,
): ExplanationView {
  if (!scan || !isUserUsageEligible(item)) return base;
  const key = usagePrefKey(item);
  const choice = getUsagePref(key);
  const caches = slimCacheHintsForUserItem(scan, item);
  const extra: string[] = [];
  if (choice === "unused") {
    extra.push("已标记「不用了」：整体视为可瘦身候选（M4 前不执行删除）。");
  } else if (choice === "active") {
    extra.push("已标记「还在用」：建议仅清理下方缓存类候选项。");
  }
  return {
    ...base,
    title: item.label,
    usageEligible: true,
    usageKey: key,
    usageChoice: choice,
    cacheCandidates: caches.map((c) => ({
      id: c.id,
      label: c.label,
      sizeGb: c.sizeGb,
      risk: c.risk,
    })),
    clues: [...(base.clues ?? []), ...extra],
  };
}

function App() {
  const [nav, setNav] = useState<NavId>("overview");
  const [screen, setScreen] = useState<OverviewScreen>("home");
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [scanError, setScanError] = useState("");
  const [progress, setProgress] = useState<ScanProgressView | null>(null);
  const [scanResult, setScanResult] = useState<ScanPayload | null>(null);
  const [scannerNote, setScannerNote] = useState<string>("");
  const [usageRevision, setUsageRevision] = useState(0);
  const scanInFlight = useRef(false);
  const unlistenProgressRef = useRef<UnlistenFn | null>(null);
  const selectedItemRef = useRef<SpaceItem | null>(null);

  const diskSummary = scanResult
    ? diskSummaryFromScan(scanResult)
    : mockDiskSummary;

  const [selectedId, setSelectedId] = useState("");
  const [explainView, setExplainView] = useState<ExplanationView>(() =>
    explanationForItem({
      id: "placeholder",
      label: "等待扫描",
      sizeGb: 0,
      path: "C:\\",
      isUnknown: true,
    }),
  );

  const applySelection = useCallback(
    (item: SpaceItem) => {
      setSelectedId(item.id);
      selectedItemRef.current = item;
      const base = explanationForItem(item, scanResult);
      setExplainView(enrichExplanation(item, base, scanResult));
    },
    [scanResult],
  );

  const onUsageChoice = useCallback(
    (key: string, choice: UsageChoice) => {
      setUsagePref(key, choice);
      setUsageRevision((n) => n + 1);
      const item = selectedItemRef.current;
      if (item && usagePrefKey(item) === key) {
        const base = explanationForItem(item, scanResult);
        setExplainView(enrichExplanation(item, base, scanResult));
      }
    },
    [scanResult],
  );

  const onNavigate = useCallback(
    (next: OverviewScreen) => {
      setScreen(next);
      if (!scanResult) return;
      if (next === "home") {
        setSelectedId("");
        selectedItemRef.current = null;
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
        applySelection(items[0]);
      } else if (next === "drill-system") {
        setExplainView(explanationForHomeBlock("system", scanResult));
      } else if (next === "drill-user") {
        setExplainView(explanationForHomeBlock("user", scanResult));
      } else {
        setExplainView(explanationForHomeBlock("slim", scanResult));
      }
    },
    [scanResult, applySelection],
  );

  useEffect(() => {
    if (!scanResult) return;
    setScreen("home");
    setSelectedId("");
    selectedItemRef.current = null;
    setExplainView(
      explanationForItem({
        id: "home-hint",
        label: "谁占用了空间",
        sizeGb: diskSummaryFromScan(scanResult).usedGb,
        path: `${scanResult.drive}\\`,
        isUnknown: true,
        clues: [
          `C: 已用约 ${diskSummaryFromScan(scanResult).usedGb.toFixed(1)} GB`,
          "用户文件按厂商名展示；可选还在用 / 不用了",
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
              onSelect={applySelection}
              onNavigate={onNavigate}
              usageRevision={usageRevision}
            />
          </div>
          <ExplanationPanel view={explainView} onUsageChoice={onUsageChoice} />
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
