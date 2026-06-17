import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { AttendanceModal } from "../../components/professor/AttendanceModal";
import { AttendanceSummaryModal } from "../../components/professor/AttendanceSummaryModal";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { apiFetchWithRetry } from "../../lib/api";
import {
  courseOrientationLabel,
  courseYearLabel,
  formatAttendanceDate,
  todayIsoDate,
} from "../../lib/professorDisplay";
import { ROUTES } from "../../routes";
import type {
  AttendanceSession,
  ProfessorAttendanceResponse,
  ProfessorCourse,
  ProfessorStudent,
  ProfessorStudentsResponse,
} from "../../types/professor";
import "../../styles/professor.css";

export default function ProfessorAttendanceCoursePage() {
  const { courseId = "" } = useParams();
  const [course, setCourse] = useState<ProfessorCourse | null>(null);
  const [students, setStudents] = useState<ProfessorStudent[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [summaryFecha, setSummaryFecha] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setError(null);
    try {
      const [studentsData, attendanceData] = await Promise.all([
        apiFetchWithRetry<ProfessorStudentsResponse>(`/api/professor/cursos/${courseId}/alumnos`),
        apiFetchWithRetry<ProfessorAttendanceResponse>(
          `/api/professor/cursos/${courseId}/asistencias`
        ),
      ]);
      setCourse(studentsData.course);
      setStudents(studentsData.students);
      setSessions(attendanceData.sessions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <DashboardLayout>
      <Link to={ROUTES.PROFESSOR_ATTENDANCE} className="professor-back-link">
        <ArrowLeft size={18} aria-hidden />
        Volver a Asistencia
      </Link>

      <header className="admin-hero">
        <CalendarClock
          size={52}
          strokeWidth={2.25}
          className="admin-hero__icon professor-hero__icon"
          aria-hidden
        />
        <div>
          <p className="admin-hero__eyebrow">Asistencia</p>
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

        <div className="professor-attendance-toolbar">
          <p className="dashboard-panel__subtitle">
            Historial de asistencias registradas para este curso.
          </p>
          <button
            type="button"
            className="projects-panel__action-btn projects-panel__action-btn--primary"
            onClick={() => setModalOpen(true)}
            disabled={loading || students.length === 0}
          >
            Tomar asistencia
          </button>
        </div>

        {loading ? (
          <div className="projects-table projects-table--empty" role="status">
            Cargando historial…
          </div>
        ) : sessions.length === 0 ? (
          <div className="projects-table projects-table--empty" role="status">
            Aún no hay asistencias registradas.
          </div>
        ) : (
          <div className="projects-table-wrapper">
            <table className="projects-table admin-table">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Asistencia</th>
                  <th scope="col">Resumen</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.fecha}>
                    <td className="projects-table__cell projects-table__cell--name" data-label="Fecha">
                      {formatAttendanceDate(session.fecha)}
                    </td>
                    <td className="projects-table__cell" data-label="Asistencia">
                      <span className="professor-attendance-ratio">
                        {session.presentes}/{session.total}
                      </span>
                    </td>
                    <td className="projects-table__cell projects-table__cell--actions" data-label="Resumen">
                      <button
                        type="button"
                        className="projects-table__action"
                        onClick={() => setSummaryFecha(session.fecha)}
                      >
                        Ver resumen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {course ? (
        <>
          <AttendanceModal
            open={modalOpen}
            courseId={course.id}
            courseName={course.name}
            students={students}
            fecha={todayIsoDate()}
            onClose={() => setModalOpen(false)}
            onSubmitted={() => {
              void loadData();
            }}
          />
          <AttendanceSummaryModal
            open={summaryFecha !== null}
            courseId={course.id}
            courseName={course.name}
            fecha={summaryFecha ?? ""}
            onClose={() => setSummaryFecha(null)}
          />
        </>
      ) : null}
    </DashboardLayout>
  );
}
