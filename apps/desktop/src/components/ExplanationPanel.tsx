import { getRuleById } from "@clarity/rules";
import type { ExplanationView } from "../data/mockHome";

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
          <p className="eyebrow">解释卡 · 尚未识别</p>
          <h2>{view.title}</h2>
          <code className="path">{view.path}</code>
        </header>
        <div className="qa">
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

  return (
    <aside className="explain">
      <header>
        <p className="eyebrow">解释卡 · 规则命中</p>
        <h2>{view.title || r.displayName}</h2>
        <code className="path">{view.path}</code>
        <div className="meta-row">
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
      {r.risk === "safe" && (
        <button type="button" className="ghost-btn" disabled title="M4 启用">
          预览后进回收站（M4）
        </button>
      )}
      {r.risk === "confirm" && (
        <p className="no-delete">需逐项确认 · M1 不执行删除</p>
      )}
      {r.risk === "forbidden" && (
        <p className="no-delete">禁止一键清理 · 请按建议使用系统工具</p>
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
