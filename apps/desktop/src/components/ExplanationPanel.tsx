import { getRuleById } from "@clarity/rules";
import { bucketTier, type ExplanationView } from "../data/homeModel";
import type { UsageChoice } from "../data/usagePrefs";
import { riskTier } from "../data/homeModel";

interface ExplanationPanelProps {
  view: ExplanationView;
  onUsageChoice?: (key: string, choice: UsageChoice) => void;
}

function riskLabel(risk: string) {
  if (risk === "safe") return { text: "安全清理", cls: "risk-safe" };
  if (risk === "confirm") return { text: "需确认", cls: "risk-confirm" };
  return { text: "禁止直接清", cls: "risk-forbidden" };
}

export function ExplanationPanel({
  view,
  onUsageChoice,
}: ExplanationPanelProps) {
  if (view.isUnknown) {
    return (
      <aside className="explain">
        <header>
          <p className="eyebrow">
            {view.eyebrow ??
              (view.title === "无权限 / 未遍历" || view.title === "其他占用"
                ? "解释卡 · 空间差额"
                : "解释卡 · 应用/文件夹")}
          </p>
          <h2>{view.title}</h2>
          <code className="path">{view.path}</code>
        </header>

        {view.usageEligible && view.usageKey && onUsageChoice && (
          <div className="usage-choice-block">
            <h3>还用不用这个应用/文件夹？</h3>
            <p className="muted usage-choice-hint">
              仅影响归类与候选项展示 · 不执行删除
            </p>
            <div className="usage-choice-btns">
              <button
                type="button"
                className={
                  view.usageChoice === "active" ? "ghost-btn on" : "ghost-btn"
                }
                onClick={() => onUsageChoice(view.usageKey!, "active")}
              >
                还在用
              </button>
              <button
                type="button"
                className={
                  view.usageChoice === "unused" ? "ghost-btn on" : "ghost-btn"
                }
                onClick={() => onUsageChoice(view.usageKey!, "unused")}
              >
                不用了 / 还不用
              </button>
            </div>
            {view.usageChoice === "unused" && (
              <p className="usage-outcome">
                已归入可瘦身候选 · 整目录视为残留（M4 再回收站）
              </p>
            )}
            {view.usageChoice === "active" &&
              (view.cacheCandidates?.length ?? 0) > 0 && (
                <div className="cache-candidates">
                  <h4>建议先清这些缓存（safe/confirm）</h4>
                  <ul>
                    {view.cacheCandidates!.map((c) => {
                      const tier = riskTier(
                        c.risk as "safe" | "confirm" | undefined,
                      );
                      return (
                        <li key={c.id}>
                          {c.label} · {c.sizeGb.toFixed(1)} GB{" "}
                          <span className={`risk-pill ${tier.cls}`}>
                            {tier.text}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            {view.usageChoice === "active" &&
              (view.cacheCandidates?.length ?? 0) === 0 && (
                <p className="muted usage-outcome">
                  暂未命中该厂商的可瘦身规则；可等待规则库扩展。
                </p>
              )}
          </div>
        )}

        <div className="qa">
          {view.title === "无权限 / 未遍历" ||
          view.title === "其他占用" ? (
            <>
              <Question
                q="为什么需要「顶目录归因」？"
                a="M2.5 按 C:\\ 下 Users/Windows/Program Files 等汇总，可读文件合计应接近 C: 已用。"
              />
              <Question
                q="差额是什么？"
                a="盘已用减去本次 walk 统计到的文件字节，主要为无权限跳过目录内的体积等。"
              />
              <Question q="删掉会怎样？" a="M2.5 不提供删除。" />
            </>
          ) : (
            <>
              <Question
                q="它是什么？"
                a="用户侧占用：按路径父目录展示为厂商或文件夹名。"
              />
              <Question q="删掉会怎样？" a="未评估前不提供删除按钮。" />
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
        <p className="no-delete">无删除操作 · 仅调查与归类</p>
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
