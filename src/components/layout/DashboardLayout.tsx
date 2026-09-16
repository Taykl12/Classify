import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import '../../styles/dashboard.css';
import { Sidebar } from './Sidebar';

interface DashboardLayoutProps {
  /** Uso directo (`<DashboardLayout>...</DashboardLayout>`). Si falta, renderiza el `<Outlet/>` del router. */
  children?: ReactNode;
}

/**
 * Layout persistente: montado una sola vez como layout route en `App.tsx`.
 * Antes cada pagina envolvia su contenido en este componente, lo que hacia que
 * React desmontara y remontara el Sidebar en cada navegacion (perdiendo las
 * transiciones de la seleccion activa).
 */
export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-main">{children ?? <Outlet />}</main>
    </div>
  );
}
