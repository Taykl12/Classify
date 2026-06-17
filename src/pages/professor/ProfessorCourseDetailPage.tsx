import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, GraduationCap, Search } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { apiFetchWithRetry } from "../../lib/api";
import {
  courseOrientationLabel,
  courseYearLabel,
  studentFullName,
  studentInitials,
} from "../../lib/professorDisplay";
import { ROUTES } from "../../routes";
import type {
  ProfessorCourse,
  ProfessorStudent,
  ProfessorStudentsResponse,
} from "../../types/professor";
import "../../styles/professor.css";

function filterStudents(students: ProfessorStudent[], query: string): ProfessorStudent[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return students;
  return students.filter((student) =>
    [studentFullName(student), student.dni].join(" ").toLowerCase().includes(needle)
  );
}

export default function ProfessorCourseDetailPage() {
  const { courseId = "" } = useParams();
  const [course, setCourse] = useState<ProfessorCourse | null>(null);
  const [students, setStudents] = useState<ProfessorStudent[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    setLoading(true);
    apiFetchWithRetry<ProfessorStudentsResponse>(`/api/professor/cursos/${courseId}/alumnos`)
      .then((data) => {
        if (!cancelled) {
          setCourse(data.course);
          setStudents(data.students);
        }
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
  }, [courseId]);

  const visibleStudents = useMemo(() => filterStudents(students, query), [students, query]);

  return (
    <DashboardLayout>
      <Link to={ROUTES.PROFESSOR_COURSES} className="professor-back-link">
        <ArrowLeft size={18} aria-hidden />
        Volver a Mis Cursos
      </Link>

      <header className="admin-hero">
        <GraduationCap
          size={52}
          strokeWidth={2.25}
          className="admin-hero__icon professor-hero__icon"
          aria-hidden
        />
        <div>
          <p className="admin-hero__eyebrow">Profesor</p>
          <h1 className="admin-hero__title">{course?.name ?? "Curso"}</h1>
          {course ? (
            <p className="admin-page-header__subtitle">
              {courseYearLabel(course)} — División {course.division || "—"} —{" "}
              {courseOrientationLabel(course)}
            </p>
          ) : null}
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
            <span className="sr-only">Buscar alumnos</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o DNI"
            />
          </label>
        </div>

        {loading ? (
          <div className="projects-table projects-table--empty" role="status">
            Cargando alumnos…
          </div>
        ) : visibleStudents.length === 0 ? (
          <div className="projects-table projects-table--empty" role="status">
            No hay alumnos para mostrar.
          </div>
        ) : (
          <div className="projects-table-wrapper">
            <table className="projects-table admin-table">
              <thead>
                <tr>
                  <th scope="col">Alumno</th>
                  <th scope="col">DNI</th>
                </tr>
              </thead>
              <tbody>
                {visibleStudents.map((student) => (
                  <tr key={student.id}>
                    <td className="projects-table__cell projects-table__cell--name" data-label="Alumno">
                      <div className="professor-student-cell">
                        {student.profilePhotoUrl ? (
                          <img
                            src={student.profilePhotoUrl}
                            alt=""
                            className="professor-student-cell__avatar"
                          />
                        ) : (
                          <span className="professor-student-cell__avatar professor-student-cell__avatar--fallback">
                            {studentInitials(student)}
                          </span>
                        )}
                        <span>{studentFullName(student)}</span>
                      </div>
                    </td>
                    <td className="projects-table__cell projects-table__cell--muted" data-label="DNI">
                      {student.dni || "—"}
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
