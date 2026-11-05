import type { NavId } from "../data/homeModel";
import { navItems } from "../data/homeModel";

interface SidebarProps {
  active: NavId;
  onNavigate: (id: NavId) => void;
}

export function Sidebar({ active, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden />
        <div>
          <div className="brand-name">Clarity Disk</div>
          <div className="brand-tag">解释式 C 盘助手</div>
        </div>
      </div>
      <nav className="nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-item${active === item.id ? " active" : ""}`}
            onClick={() => onNavigate(item.id)}
          >
            <span>{item.label}</span>
            {item.badge != null && (
              <span className="badge">{item.badge}</span>
            )}
          </button>
        ))}
      </nav>
      <p className="sidebar-foot">
        规则决定能否删除 · AI 仅解释 · 未知无删除按钮
      </p>
    </aside>
  );
}
