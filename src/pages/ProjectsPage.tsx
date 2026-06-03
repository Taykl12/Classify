import { useEffect, useState } from "react";
import { Laptop } from "lucide-react";
import { ProjectsListSection } from "../components/projects/ProjectsListSection";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { apiFetch } from "../lib/api";
import type { ProjectListItem } from "../types/projects";
import "../styles/dashboard.css";
import "../styles/projects-page.css";

export default function ProjectsPage() {
  const [items, setItems] = useState<ProjectListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<ProjectListItem[]>("/api/projects");
        if (!cancelled) setItems(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <DashboardLayout>
      <header className="projects-page__hero">
        <Laptop size={52} strokeWidth={2.25} className="projects-page__hero-icon" aria-hidden />
        <h1 id="projects-page-title" className="projects-page__hero-title">Mis Proyectos</h1>
      </header>
      <section className="dashboard-panel" aria-labelledby="projects-page-title">
        {error ? <p className="dashboard-error" role="alert">{error}</p> : null}
        {loading ? <p className="dashboard-loading">Cargando proyectos…</p> : null}
        <div className="projects-panel__toolbar">
          <div className="projects-panel__actions">
            <button type="button" className="projects-panel__action-btn">Borrar Proyecto</button>
            <button type="button" className="projects-panel__action-btn">Crear Proyecto</button>
          </div>
        </div>
        <ProjectsListSection items={items} />
      </section>
    </DashboardLayout>
  );
}
