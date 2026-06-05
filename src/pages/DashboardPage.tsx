import { useEffect, useState } from "react";
import { FeaturedProjectsCarousel } from "../components/dashboard/FeaturedProjectsCarousel";
import { PendingProjectsSection } from "../components/dashboard/PendingProjectsSection";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { apiFetch } from "../lib/api";
import type { PendingItem, Project } from "../types/dashboard";
import "../styles/dashboard.css";

export default function DashboardPage() {
  const [featured, setFeatured] = useState<Project[]>([]);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [f, p] = await Promise.all([
          apiFetch<Project[]>("/api/dashboard/featured"),
          apiFetch<PendingItem[]>("/api/dashboard/pending"),
        ]);
        if (!cancelled) {
          setFeatured(f);
          setPending(p);
        }
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
      {error ? <p className="dashboard-error" role="alert">{error}</p> : null}
      {loading ? <p className="dashboard-loading">Cargando datos…</p> : null}
      <section className="dashboard-panel dashboard-panel--featured" aria-labelledby="featured-title">
        <div className="dashboard-panel__header">
          <h2 id="featured-title" className="dashboard-panel__title">Proyectos Destacados</h2>
          <p className="dashboard-panel__subtitle">
            Favoritos desde Mis Proyectos (estrella)
          </p>
        </div>
        {!loading && featured.length === 0 ? (
          <p className="dashboard-panel__empty" role="status">
            Marcá proyectos con la estrella en Mis Proyectos para verlos aquí.
          </p>
        ) : (
          <FeaturedProjectsCarousel projects={featured} />
        )}
      </section>
      <section className="dashboard-panel" aria-labelledby="pending-title">
        <div className="dashboard-panel__header">
          <h2 id="pending-title" className="dashboard-panel__title">Pendientes</h2>
          <p className="dashboard-panel__subtitle">Tareas que requieren tu atención</p>
        </div>
        <PendingProjectsSection items={pending} />
      </section>
    </DashboardLayout>
  );
}
