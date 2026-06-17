import { useEffect, useState } from "react";
import { AdminModal } from "../admin/AdminModal";
import { apiFetchWithRetry } from "../../lib/api";
import { formatAttendanceDate, studentFullName, studentInitials } from "../../lib/professorDisplay";
import type { AttendanceDetailResponse, AttendanceStatus } from "../../types/professor";

interface AttendanceSummaryModalProps {
  open: boolean;
  courseId: string;
  courseName: string;
  fecha: string;
  onClose: () => void;
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  Presente: "Presente",
  Ausente: "Ausente",
  Tardanza: "Tardanza",
};

export function AttendanceSummaryModal({
  open,
  courseId,
  courseName,
  fecha,
  onClose,
}: AttendanceSummaryModalProps) {
  const [detail, setDetail] = useState<AttendanceDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !courseId || !fecha) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    apiFetchWithRetry<AttendanceDetailResponse>(
      `/api/professor/cursos/${courseId}/asistencias/${fecha}`
    )
      .then((data) => {
        if (!cancelled) setDetail(data);
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
  }, [open, courseId, fecha]);

  return (
    <AdminModal
      open={open}
      title={`Resumen de asistencia — ${courseName}`}
      error={error}
      onClose={onClose}
      footer={
        <button
          type="button"
          className="project-modal__btn project-modal__btn--primary"
          onClick={onClose}
        >
          Cerrar
        </button>
      }
    >
      <div className="professor-attendance-summary">
        <p className="professor-attendance-summary__date">
          {formatAttendanceDate(fecha)}
        </p>
        {loading ? (
          <p className="professor-attendance-summary__status" role="status">
            Cargando resumen…
          </p>
        ) : detail ? (
          <>
            <p className="professor-attendance-summary__ratio">
              Asistieron {detail.presentes} de {detail.total} alumnos
            </p>
            <div className="projects-table-wrapper professor-attendance-modal__table-wrap">
              <table className="projects-table admin-table professor-attendance-modal__table">
                <thead>
                  <tr>
                    <th scope="col">Alumno</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Comentarios</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.registros.map((record) => (
                    <tr key={record.student.id}>
                      <td className="projects-table__cell" data-label="Alumno">
                        <div className="professor-student-cell">
                          {record.student.profilePhotoUrl ? (
                            <img
                              src={record.student.profilePhotoUrl}
                              alt=""
                              className="professor-student-cell__avatar"
                            />
                          ) : (
                            <span className="professor-student-cell__avatar professor-student-cell__avatar--fallback">
                              {studentInitials(record.student)}
                            </span>
                          )}
                          <span>{studentFullName(record.student)}</span>
                        </div>
                      </td>
                      <td className="projects-table__cell" data-label="Estado">
                        <span
                          className={`professor-attendance-summary__badge professor-attendance-summary__badge--${record.estado.toLowerCase()}`}
                        >
                          {STATUS_LABELS[record.estado]}
                        </span>
                      </td>
                      <td
                        className="projects-table__cell projects-table__cell--muted"
                        data-label="Comentarios"
                      >
                        {record.observaciones || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </AdminModal>
  );
}
