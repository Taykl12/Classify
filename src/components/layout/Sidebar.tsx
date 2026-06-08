import type { ReactNode } from "react";
import {
  CalendarClock,
  Home,
  Layers,
  LogOut,
  Settings,
  User,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useSidebarCollapsed } from "../../hooks/useSidebarCollapsed";
import { ROUTES } from "../../routes";
import "../../styles/sidebar.css";
import "../../styles/theme-toggle.css";
import { SidebarToggle } from "./SidebarToggle";
import { ThemeToggleButton } from "./ThemeToggleButton";

interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  to?: string;
  action?: "logout";
}

const MAIN_NAV: NavItem[] = [
  {
    id: "home",
    label: "Inicio",
    icon: <Home size={22} aria-hidden />,
    to: ROUTES.DASHBOARD,
  },
  {
    id: "projects",
    label: "Proyectos",
    icon: <Layers size={22} aria-hidden />,
    to: ROUTES.PROJECTS,
  },
  {
    id: "calendar",
    label: "Calendario",
    icon: <CalendarClock size={22} aria-hidden />,
    to: ROUTES.CALENDARY,
  },
];

const FOOTER_NAV: NavItem[] = [
  { id: "settings", label: "Preferencias", icon: <Settings size={22} aria-hidden /> },
  { id: "logout", label: "Cerrar Sesión", icon: <LogOut size={22} aria-hidden />, action: "logout" },
];

function navItemClassName(isActive: boolean): string {
  return isActive
    ? "sidebar__nav-item sidebar__nav-item--active"
    : "sidebar__nav-item";
}

function NavLinkItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const { pathname } = useLocation();
  if (!item.to) return null;
  const isHome = item.to === ROUTES.DASHBOARD;
  const isActive = isHome ? pathname === ROUTES.DASHBOARD : pathname === item.to;
  return (
    <NavLink
      to={item.to}
      end={isHome}
      className={navItemClassName(isActive)}
      aria-current={isActive ? "page" : undefined}
    >
      <span className="sidebar__nav-icon">{item.icon}</span>
      <span className={collapsed ? "sr-only" : "sidebar__label"}>{item.label}</span>
    </NavLink>
  );
}

function NavButtonItem({
  item,
  collapsed,
  onLogout,
}: {
  item: NavItem;
  collapsed: boolean;
  onLogout?: () => void;
}) {
  function handleClick() {
    if (item.action === "logout") onLogout?.();
  }

  return (
    <button type="button" className="sidebar__nav-item" onClick={handleClick}>
      <span className="sidebar__nav-icon">{item.icon}</span>
      <span className={collapsed ? "sr-only" : "sidebar__label"}>{item.label}</span>
    </button>
  );
}

function NavItemRow({
  item,
  collapsed,
  onLogout,
}: {
  item: NavItem;
  collapsed: boolean;
  onLogout?: () => void;
}) {
  if (item.to) return <NavLinkItem item={item} collapsed={collapsed} />;
  return (
    <NavButtonItem
      item={item}
      collapsed={collapsed}
      onLogout={onLogout}
    />
  );
}

export function Sidebar() {
  const { collapsed, toggle } = useSidebarCollapsed(true);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const modifier = collapsed ? "sidebar--collapsed" : "sidebar--expanded";
  const fullName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Usuario"
    : "Usuario";
  const profileLine =
    !collapsed && user?.roleLabel ? `${fullName} - ${user.roleLabel}` : fullName;

  async function handleLogout() {
    await logout();
    navigate(ROUTES.LOGIN, { replace: true });
  }

  return (
    <aside className={`sidebar ${modifier}`} aria-label="Navegación principal">
      <div className="sidebar__header">
        <SidebarToggle collapsed={collapsed} onToggle={toggle} />
      </div>
      <div className="sidebar__profile-block">
        <div className="sidebar__profile">
          <div className="sidebar__avatar" aria-hidden>
            <User size={collapsed ? 20 : 24} />
          </div>
          <p className="sidebar__profile-name">{profileLine}</p>
        </div>
      </div>
      <nav className="sidebar__nav-block sidebar__nav" aria-label="Menú">
        {MAIN_NAV.map((item) => (
          <NavItemRow key={item.id} item={item} collapsed={collapsed} />
        ))}
      </nav>
      <div className="sidebar__footer-block sidebar__nav" aria-label="Cuenta">
        <ThemeToggleButton
          className="sidebar__nav-item theme-toggle theme-toggle--sidebar"
          collapsed={collapsed}
        />
        {FOOTER_NAV.map((item) => (
          <NavItemRow
            key={item.id}
            item={item}
            collapsed={collapsed}
            onLogout={handleLogout}
          />
        ))}
      </div>
    </aside>
  );
}
