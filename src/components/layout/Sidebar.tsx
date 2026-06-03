import type { ReactNode } from 'react';
import {
  CalendarClock,
  Home,
  Layers,
  LogOut,
  Settings,
  User,
} from 'lucide-react';
import { useSidebarCollapsed } from '../../hooks/useSidebarCollapsed';
import '../../styles/sidebar.css';
import { SidebarToggle } from './SidebarToggle';

interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
}

const MAIN_NAV: NavItem[] = [
  { id: 'home', label: 'Inicio', icon: <Home size={22} aria-hidden /> },
  { id: 'projects', label: 'Proyectos', icon: <Layers size={22} aria-hidden /> },
  {
    id: 'calendar',
    label: 'Calendario',
    icon: <CalendarClock size={22} aria-hidden />,
  },
];

const FOOTER_NAV: NavItem[] = [
  { id: 'settings', label: 'Preferencias', icon: <Settings size={22} aria-hidden /> },
  { id: 'logout', label: 'Cerrar Sesión', icon: <LogOut size={22} aria-hidden /> },
];

function NavButton({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  return (
    <button type="button" className="sidebar__nav-item">
      <span className="sidebar__nav-icon">{item.icon}</span>
      <span className={collapsed ? 'sr-only' : 'sidebar__label'}>{item.label}</span>
    </button>
  );
}

export function Sidebar() {
  const { collapsed, toggle } = useSidebarCollapsed(true);
  const modifier = collapsed ? 'sidebar--collapsed' : 'sidebar--expanded';

  return (
    <aside className={`sidebar ${modifier}`} aria-label="Navegación principal">
      <div className="sidebar__header">
        <SidebarToggle collapsed={collapsed} onToggle={toggle} />
      </div>

      <div className="sidebar__profile-block">
        <div className="sidebar__profile">
          <div className="sidebar__avatar" aria-hidden>
            <User size={collapsed ? 22 : 28} />
          </div>
          <p className="sidebar__profile-name">Nombre y Apellido - Cargo</p>
        </div>
      </div>

      <nav className="sidebar__nav-block sidebar__nav" aria-label="Menú">
        {MAIN_NAV.map((item) => (
          <NavButton key={item.id} item={item} collapsed={collapsed} />
        ))}
      </nav>

      <div className="sidebar__footer-block sidebar__nav" aria-label="Cuenta">
        {FOOTER_NAV.map((item) => (
          <NavButton key={item.id} item={item} collapsed={collapsed} />
        ))}
      </div>
    </aside>
  );
}
