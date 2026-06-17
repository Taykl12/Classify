import { useEffect, useState } from "react";
import { AdminModal } from "../admin/AdminModal";
import { ApiError, apiFetch } from "../../lib/api";
import { studentFullName, studentInitials } from "../../lib/professorDisplay";
import type {
  AttendanceStatus,
  AttendanceSubmitPayload,
  ProfessorStudent,
} from "../../types/professor";

interface AttendanceModalProps {
  open: boolean;
  courseId: string;
  courseName: string;
  students: ProfessorStudent[];
  fecha: string;
  onClose: () => void;
  onSubmitted: () => void;
}

interface StudentAttendanceState {
  estado: AttendanceStatus;
  observaciones: string;
}

const STATUS_OPTIONS: Array<{ value: AttendanceStatus; label: string }> = [
  { value: "Presente", label: "P" },
  { value: "Ausente", label: "A" },
  { value: "Tardanza", label: "T" },
];

function emptyAttendanceMap(students: ProfessorStudent[]): Record<string, StudentAttendanceState> {
  return Object.fromEntries(
    students.map((student) => [
      student.id,
      { estado: "Ausente" as AttendanceStatus, observaciones: "" },
    ])
  );
}

export function AttendanceModal({
  open,
  courseId,
  courseName,
  students,
  fecha,
  onClose,
  onSubmitted,
}: AttendanceModalProps) {
  const [attendance, setAttendance] = useState<Record<string, StudentAttendanceState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAttendance(emptyAttendanceMap(students));
      setError(null);
    }
  }, [open, students]);

  function updateStatus(studentId: string, estado: AttendanceStatus) {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], estado },
    }));
  }

  function updateNote(studentId: string, observaciones: string) {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], observaciones },
    }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const payload: AttendanceSubmitPayload = {
      fecha,
      registros: students.map((student) => ({
        id_usuario: student.id,
        estado: attendance[student.id]?.estado ?? "Ausente",
        observaciones: attendance[student.id]?.observaciones?.trim() || undefined,
      })),
    };
    try {
      await apiFetch(`/api/professor/cursos/${courseId}/asistencias`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      onSubmitted();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo guardar la asistencia");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminModal
      open={open}
      title={`Tomar asistencia — ${courseName}`}
      error={error}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="project-modal__btn project-modal__btn--muted"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="project-modal__btn project-modal__btn--primary"
            onClick={handleSubmit}
            disabled={submitting || students.length === 0}
          >
            {submitting ? "Subiendo…" : "Subir"}
          </button>
        </>
      }
    >
      <div className="professor-attendance-modal">
        <p className="professor-attendance-modal__meta">
          {students.length} alumnos en total
        </p>
        <div className="professor-attendance-modal__legend" aria-hidden>
          <span className="professor-attendance-modal__legend-item professor-attendance-modal__legend-item--present">
            Presente
          </span>
          <span className="professor-attendance-modal__legend-item professor-attendance-modal__legend-item--absent">
            Ausente
          </span>
          <span className="professor-attendance-modal__legend-item professor-attendance-modal__legend-item--late">
            Tardanza
          </span>
        </div>
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
              {students.map((student) => {
                const state = attendance[student.id];
                return (
                  <tr key={student.id}>
                    <td className="projects-table__cell" data-label="Alumno">
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
                    <td className="projects-table__cell" data-label="Estado">
                      <div className="professor-attendance-status">
                        {STATUS_OPTIONS.map((option) => (
                          <label key={option.value} className="professor-attendance-status__option">
                            <input
                              type="radio"
                              name={`attendance-${student.id}`}
                              value={option.value}
                              checked={state?.estado === option.value}
                              onChange={() => updateStatus(student.id, option.value)}
                            />
                            <span
                              className={`professor-attendance-status__pill professor-attendance-status__pill--${option.value.toLowerCase()}`}
                            >
                              {option.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </td>
                    <td className="projects-table__cell" data-label="Comentarios">
                      <input
                        type="text"
                        className="professor-attendance-modal__note"
                        value={state?.observaciones ?? ""}
                        onChange={(e) => updateNote(student.id, e.target.value)}
                        placeholder="Agregar nota…"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AdminModal>
  );
}
