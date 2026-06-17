import { useEffect, useState } from "react";
import { CalendarClock, GraduationCap, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { apiFetchWithRetry } from "../../lib/api";
import { ROUTES } from "../../routes";
import type { ProfessorSummary } from "../../types/professor";
import "../../styles/professor.css";

const QUICK_LINKS = [
  {
    label: "Mis Cursos",
    description: "Ver cursos asignados y alumnos de cada división.",
    to: ROUTES.PROFESSOR_COURSES,
    icon: <GraduationCap size={24} aria-hidden />,
  },
  {
    label: "Asistencia",
    description: "Tomar asistencia y revisar el historial por curso.",
    to: ROUTES.PROFESSOR_ATTENDANCE,
    icon: <CalendarClock size={24} aria-hidden />,
  },
] as const;

export default function ProfessorDashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<ProfessorSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fullName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Profesor"
    : "Profesor";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetchWithRetry<ProfessorSummary>("/api/professor/summary")
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardLayout>
      <header className="admin-hero">
        <GraduationCap
          size={52}
          strokeWidth={2.25}
          className="admin-hero__icon professor-hero__icon"
          aria-hidden
        />
        <div>
          <p className="admin-hero__eyebrow">Profesor</p>
          <h1 className="admin-hero__title">Panel Principal</h1>
        </div>
      </header>

      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <h2 className="dashboard-panel__title">Hola, {fullName}</h2>
          <p className="dashboard-panel__subtitle">
            Resumen de tus cursos asignados y accesos rápidos.
          </p>
        </div>
        {error ? (
          <p className="dashboard-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="admin-stats" aria-busy={loading}>
          <article className="admin-stat-card">
            <span>Cursos asignados</span>
            <strong>{loading ? "…" : summary?.courses ?? 0}</strong>
          </article>
          <article className="admin-stat-card">
            <span>Alumnos totales</span>
            <strong>{loading ? "…" : summary?.students ?? 0}</strong>
          </article>
          <article className="admin-stat-card">
            <span>Rol</span>
            <strong>
              <Users size={28} aria-hidden />
            </strong>
          </article>
        </div>
      </section>

      <section className="admin-grid" aria-label="Accesos rápidos">
        {QUICK_LINKS.map((item) => (
          <Link key={item.to} to={item.to} className="admin-quick-card">
            <span className="admin-quick-card__icon">{item.icon}</span>
            <strong>{item.label}</strong>
            <span>{item.description}</span>
          </Link>
        ))}
      </section>
    </DashboardLayout>
  );
}
