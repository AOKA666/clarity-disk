import type { DiskSummary } from "../data/homeModel";

interface CapacityRingProps {
  summary: DiskSummary;
  scanning?: boolean;
  scanLabel?: string;
}

export function CapacityRing({ summary, scanning, scanLabel }: CapacityRingProps) {
  const usedPct =
    summary.totalGb > 0
      ? Math.round((summary.usedGb / summary.totalGb) * 100)
      : 0;
  const freeGb = summary.freeGb;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - usedPct / 100);

  return (
    <section className="hero">
      <div className="hero-text">
        <p className="eyebrow">
          {summary.drive} 本地分析
          {scanning ? " · 正在只读扫描…" : " · 真实数据"}
        </p>
        <h1>{freeGb.toFixed(1)} GB 可用</h1>
        <p className="muted">
          已用 {summary.usedGb.toFixed(1)} / {summary.totalGb.toFixed(1)} GB ·
          预计可整理{" "}
          <strong>{summary.reclaimableGb.toFixed(1)} GB</strong>（safe 规则合计）
        </p>
        {scanLabel && <p className="scan-status">{scanLabel}</p>}
        <span className="pill">全本地分析 · 不上传路径</span>
      </div>
      <div className="ring-wrap" aria-label={`C 盘使用率 ${usedPct}%`}>
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth="10"
          />
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 70 70)"
          />
          <text
            x="70"
            y="68"
            textAnchor="middle"
            fill="var(--text)"
            fontSize="22"
            fontWeight="600"
          >
            {usedPct}%
          </text>
          <text
            x="70"
            y="88"
            textAnchor="middle"
            fill="var(--text-muted)"
            fontSize="11"
          >
            已使用
          </text>
        </svg>
      </div>
    </section>
  );
}
