import { FeaturedProjectsCarousel } from '../components/dashboard/FeaturedProjectsCarousel';
import { PendingProjectsSection } from '../components/dashboard/PendingProjectsSection';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { FEATURED_PROJECTS, PENDING_ITEMS } from '../types/dashboard';
import '../styles/dashboard.css';

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <section
        className="dashboard-panel dashboard-panel--featured"
        aria-labelledby="featured-title"
      >
        <div className="dashboard-panel__header">
          <h2 id="featured-title" className="dashboard-panel__title">
            Proyectos Destacados
          </h2>
        </div>
        <FeaturedProjectsCarousel projects={FEATURED_PROJECTS} />
      </section>

      <section className="dashboard-panel" aria-labelledby="pending-title">
        <div className="dashboard-panel__header">
          <h2 id="pending-title" className="dashboard-panel__title">
            Pendientes
          </h2>
          <p className="dashboard-panel__subtitle">
            Tareas que requieren tu atención
          </p>
        </div>
        <PendingProjectsSection items={PENDING_ITEMS} />
      </section>
    </DashboardLayout>
  );
}
