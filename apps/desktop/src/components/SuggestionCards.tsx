import type { SuggestionCard } from "../data/homeModel";

interface SuggestionCardsProps {
  cards: SuggestionCard[];
  onSelect: (card: SuggestionCard) => void;
}

export function SuggestionCards({ cards, onSelect }: SuggestionCardsProps) {
  return (
    <section className="panel suggestions">
      <header className="panel-head">
        <div>
          <h2>值得关注</h2>
          <p className="muted">三桶视图 · 你的文件 / 可瘦身 / 系统别动</p>
        </div>
      </header>
      <div className="card-grid">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            className={`s-card risk-${card.risk}${card.bucket ? ` bucket-${card.bucket}` : ""}`}
            onClick={() => onSelect(card)}
          >
            <span className="s-title">{card.title}</span>
            <span className="s-size">{card.sizeGb.toFixed(1)} GB</span>
            <span className="s-sub">{card.subtitle}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
