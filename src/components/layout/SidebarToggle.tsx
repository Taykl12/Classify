import { Menu, PanelLeftClose } from 'lucide-react';
import '../../styles/sidebar.css';

interface SidebarToggleProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function SidebarToggle({ collapsed, onToggle }: SidebarToggleProps) {
  return (
    <button
      type="button"
      className="sidebar__toggle"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
    >
      {collapsed ? <Menu size={20} aria-hidden /> : <PanelLeftClose size={20} aria-hidden />}
    </button>
  );
}
