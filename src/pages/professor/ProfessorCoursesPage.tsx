import { useEffect, useMemo, useState } from "react";
import { ArrowRight, GraduationCap, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { apiFetchWithRetry } from "../../lib/api";
import {
  courseOrientationLabel,
  courseYearLabel,
} from "../../lib/professorDisplay";
import { ROUTES } from "../../routes";
import type { ProfessorCourse, ProfessorCoursesResponse } from "../../types/professor";
import "../../styles/professor.css";

function filterCourses(courses: ProfessorCourse[], query: string): ProfessorCourse[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return courses;
  return courses.filter((course) =>
    [
      course.name,
      courseYearLabel(course),
      course.division,
      courseOrientationLabel(course),
      String(course.studentCount),
    ]
      .join(" ")
      .toLowerCase()
      .includes(needle)
  );
}

export default function ProfessorCoursesPage() {
  const [courses, setCourses] = useState<ProfessorCourse[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetchWithRetry<ProfessorCoursesResponse>("/api/professor/cursos")
      .then((data) => {
        if (!cancelled) setCourses(data.courses);
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

  const visibleCourses = useMemo(() => filterCourses(courses, query), [courses, query]);

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
          <h1 className="admin-hero__title">Mis Cursos</h1>
        </div>
      </header>

      <section className="dashboard-panel">
        {error ? (
          <p className="dashboard-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="admin-toolbar">
          <label className="admin-search">
            <Search size={18} aria-hidden />
            <span className="sr-only">Buscar cursos</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por año, división u orientación"
            />
          </label>
        </div>

        {loading ? (
          <div className="projects-table projects-table--empty" role="status">
            Cargando cursos…
          </div>
        ) : visibleCourses.length === 0 ? (
          <div className="projects-table projects-table--empty" role="status">
            No hay cursos asignados para mostrar.
          </div>
        ) : (
          <div className="projects-table-wrapper">
            <table className="projects-table admin-table">
              <thead>
                <tr>
                  <th scope="col">Curso</th>
                  <th scope="col">Año</th>
                  <th scope="col">División</th>
                  <th scope="col">Orientación</th>
                  <th scope="col">Alumnos</th>
                  <th scope="col">Ver</th>
                </tr>
              </thead>
              <tbody>
                {visibleCourses.map((course) => (
                  <tr key={course.id}>
                    <td className="projects-table__cell projects-table__cell--name" data-label="Curso">
                      <span>{course.name}</span>
                    </td>
                    <td className="projects-table__cell projects-table__cell--muted" data-label="Año">
                      {courseYearLabel(course)}
                    </td>
                    <td className="projects-table__cell projects-table__cell--muted" data-label="División">
                      {course.division ? `${course.division}ª` : "—"}
                    </td>
                    <td className="projects-table__cell projects-table__cell--muted" data-label="Orientación">
                      {courseOrientationLabel(course)}
                    </td>
                    <td className="projects-table__cell projects-table__cell--muted" data-label="Alumnos">
                      {course.studentCount}
                    </td>
                    <td className="projects-table__cell projects-table__cell--actions" data-label="Ver">
                      <Link
                        to={ROUTES.professorCourse(course.id)}
                        className="professor-course-link"
                      >
                        Ver alumnos
                        <ArrowRight size={16} aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </DashboardLayout>
  );
}
