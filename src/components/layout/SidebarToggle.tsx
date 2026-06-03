import { Menu, PanelLeftClose } from 'lucide-react';
import '../../styles/sidebar.css';

interface SidebarToggleProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function SidebarToggle({ collapsed, onToggle }: SidebarToggleProps) {
  const modifier = collapsed
    ? 'sidebar__toggle--collapsed'
    : 'sidebar__toggle--expanded';

  return (
    <button
      type="button"
      className={`sidebar__toggle ${modifier}`}
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={collapsed ? 'Abrir menú' : 'Ocultar menú'}
    >
      {collapsed ? (
        <Menu size={20} aria-hidden />
      ) : (
        <>
          <PanelLeftClose size={20} aria-hidden />
          <span className="sidebar__toggle-label">Ocultar menú</span>
        </>
      )}
    </button>
  );
}
