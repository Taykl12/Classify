import { useEffect, useState } from "react";
import { AdminModal } from "./AdminModal";
import { ApiError, apiFetch } from "../../lib/api";

interface TeacherAttendanceResetModalProps {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

export function TeacherAttendanceResetModal({
  open,
  onClose,
  onDone,
}: TeacherAttendanceResetModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setSubmitting(false);
    setError(null);
    setDeleted(null);
  }, [open]);

  const handleClose = () => {
    setError(null);
    setDeleted(null);
    onClose();
  };

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiFetch<{ fecha: string; deleted: number }>(
        "/api/admin/asistencia-profesores",
        { method: "DELETE" }
      );
      setDeleted(result.deleted);
      onDone();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "No se pudieron resetear las asistencias"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminModal
      open={open}
      title="Resetear asistencias"
      error={error}
      onClose={handleClose}
      footer={
        deleted !== null ? (
          <button
            type="button"
            className="project-modal__btn project-modal__btn--primary"
            onClick={handleClose}
          >
            Cerrar
          </button>
        ) : (
          <>
            <button
              type="button"
              className="project-modal__btn project-modal__btn--muted"
              onClick={handleClose}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="project-modal__btn project-modal__btn--primary"
              onClick={() => void handleConfirm()}
              disabled={submitting}
            >
              {submitting ? "Borrando…" : "Borrar asistencias de hoy"}
            </button>
          </>
        )
      }
    >
      {deleted !== null ? (
        <p className="teacher-attendance-correction__intro">
          Se eliminaron {deleted} {deleted === 1 ? "asistencia" : "asistencias"} de hoy.
        </p>
      ) : (
        <p className="teacher-attendance-correction__intro">
          Se eliminarán <strong>todas las asistencias registradas hoy</strong> y su
          historial de correcciones. Esta acción no se puede deshacer.
        </p>
      )}
    </AdminModal>
  );
}
