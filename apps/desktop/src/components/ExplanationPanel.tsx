import { getRuleById } from "@clarity/rules";
import { bucketTier, type ExplanationView } from "../data/homeModel";

interface ExplanationPanelProps {
  view: ExplanationView;
}

function riskLabel(risk: string) {
  if (risk === "safe") return { text: "安全清理", cls: "risk-safe" };
  if (risk === "confirm") return { text: "需确认", cls: "risk-confirm" };
  return { text: "禁止直接清", cls: "risk-forbidden" };
}

export function ExplanationPanel({ view }: ExplanationPanelProps) {
  if (view.isUnknown) {
    return (
      <aside className="explain">
        <header>
          <p className="eyebrow">
            {view.eyebrow ??
              (view.title === "无权限 / 未遍历" || view.title === "其他占用"
                ? "解释卡 · 空间差额"
                : "解释卡 · 尚未识别")}
          </p>
          <h2>{view.title}</h2>
          <code className="path">{view.path}</code>
        </header>
        <div className="qa">
          {view.title === "无权限 / 未遍历" ||
          view.title === "其他占用" ? (
            <>
              <Question
                q="为什么需要「顶目录归因」？"
                a="M2.5 按 C:\\ 下 Users/Windows/Program Files 等汇总，可读文件合计应接近 C: 已用；与本列表三桶互补。"
              />
              <Question
                q="差额是什么？"
                a="盘已用减去本次 walk 统计到的文件字节，主要为无权限跳过目录内的体积、文件系统元数据等。"
              />
              <Question q="删掉会怎样？" a="M2.5 不提供删除；需先弄清目录来源。" />
              <Question
                q="建议怎么做？"
                a="查看下方线索；以管理员打开资源管理器或等待后续版本细化规则。"
              />
            </>
          ) : (
            <>
              <Question q="它是什么？" a="暂无规则匹配，不能自动归类到已知应用或用途。" />
              <Question q="谁产生的？" a="来源未知，需结合修改时间与文件类型判断。" />
              <Question
                q="删掉会怎样？"
                a="风险未评估。产品策略：未知项不提供删除按钮。"
              />
              <Question
                q="建议怎么做？"
                a="使用调查线索核对后再决定；可等待规则库更新或手动备份后处理。"
              />
            </>
          )}
        </div>
        <div className="evidence">
          <h3>调查线索</h3>
          <ul>
            {(view.clues ?? []).map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
        <p className="no-delete">无删除操作 · 仅调查模式</p>
      </aside>
    );
  }

  const r = view.ruleId ? getRuleById(view.ruleId) : undefined;
  if (!r) {
    return (
      <aside className="explain">
        <p className="muted">未找到规则 {view.ruleId}</p>
      </aside>
    );
  }

  const risk = riskLabel(r.risk);
  const bucket = bucketTier(r.bucket);

  return (
    <aside className="explain">
      <header>
        <p className="eyebrow">解释卡 · 规则命中</p>
        <h2>{view.title || r.displayName}</h2>
        <code className="path">{view.path}</code>
        <div className="meta-row">
          <span className={`risk-pill ${bucket.cls}`}>{bucket.text}</span>
          <span className={`risk-pill ${risk.cls}`}>{risk.text}</span>
          <span className="muted">
            可信度 {(r.confidence * 100).toFixed(0)}% · {r.ownerApp}
          </span>
        </div>
      </header>
      <div className="qa">
        <Question q="它是什么？" a={r.what} />
        <Question q="谁产生的？" a={`${r.ownerApp} · ${r.purpose}`} />
        <Question q="删掉会怎样？" a={r.riskText} />
        <Question q="建议怎么做？" a={r.advice} />
      </div>
      <div className="evidence">
        <h3>证据</h3>
        <ul>
          {r.evidence.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </div>
      {r.bucket === "user" && (
        <p className="no-delete">你的文件 · 仅识别占用 · 不提供清理</p>
      )}
      {r.bucket === "slim" && r.risk === "safe" && (
        <button type="button" className="ghost-btn" disabled title="M4 启用">
          预览后进回收站（M4）
        </button>
      )}
      {r.bucket === "slim" && r.risk === "confirm" && (
        <p className="no-delete">可瘦身 · 需确认 · M2.5 不执行删除</p>
      )}
      {r.bucket === "system" && (
        <p className="no-delete">系统别动 · 请按建议使用系统工具</p>
      )}
    </aside>
  );
}

function Question({ q, a }: { q: string; a: string }) {
  return (
    <div className="q-block">
      <h3>{q}</h3>
      <p>{a}</p>
    </div>
  );
}
