import { useEffect, useState, type FormEvent } from "react";
import { AdminModal } from "./AdminModal";
import { ApiError, apiFetch } from "../../lib/api";
import type { TeacherAttendanceEstado } from "../../types/admin";

interface TeacherAttendanceCorrectionModalProps {
  open: boolean;
  userId: string;
  professorName: string;
  fecha: string;
  inicial?: {
    estado: TeacherAttendanceEstado;
    horaEntrada: string | null;
    observaciones: string;
  } | null;
  onClose: () => void;
  onSaved: () => void;
}

const STATE_OPTIONS: TeacherAttendanceEstado[] = [
  "Presente",
  "Tardanza",
  "Ausente",
  "Justificado",
];

const DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return DATE_FORMATTER.format(new Date(`${value}T12:00:00`));
}

export function TeacherAttendanceCorrectionModal({
  open,
  userId,
  professorName,
  fecha,
  inicial,
  onClose,
  onSaved,
}: TeacherAttendanceCorrectionModalProps) {
  const [estado, setEstado] = useState<TeacherAttendanceEstado>("Presente");
  const [horaEntrada, setHoraEntrada] = useState("");
  const [motivo, setMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEstado(inicial?.estado ?? "Presente");
    setHoraEntrada(inicial?.horaEntrada ?? "");
    setMotivo(inicial?.observaciones ?? "");
    setError(null);
  }, [open, inicial]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/asistencia-profesores/${userId}/correccion`, {
        method: "POST",
        body: JSON.stringify({ fecha, estado, horaEntrada, motivo }),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo guardar la corrección");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminModal
      open={open}
      title="Corregir asistencia"
      error={error}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="project-modal__btn project-modal__btn--muted"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="teacher-correction-form"
            className="project-modal__btn project-modal__btn--primary"
            disabled={submitting}
          >
            {submitting ? "Guardando…" : "Guardar corrección"}
          </button>
        </>
      }
    >
      <form id="teacher-correction-form" className="admin-form" onSubmit={handleSubmit}>
        <p className="teacher-attendance-correction__intro">
          <strong>{professorName}</strong> — {formatDate(fecha)}
        </p>

        <label className="project-modal__label">
          Estado
          <select
            className="project-modal__input"
            value={estado}
            onChange={(e) => setEstado(e.target.value as TeacherAttendanceEstado)}
          >
            {STATE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="project-modal__label">
          Hora de entrada
          <input
            type="time"
            className="project-modal__input"
            value={horaEntrada}
            onChange={(e) => setHoraEntrada(e.target.value)}
          />
          <span className="admin-form__hint">
            Podés dejarla vacía para Ausente o Justificado.
          </span>
        </label>

        <label className="project-modal__label">
          Motivo de la corrección
          <textarea
            className="project-modal__input"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            required
            placeholder="Ej.: el lector no reconoció la huella"
          />
        </label>
      </form>
    </AdminModal>
  );
}
