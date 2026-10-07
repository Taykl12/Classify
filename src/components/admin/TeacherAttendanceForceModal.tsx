import { useCallback, useEffect, useState } from "react";
import { Fingerprint, Loader2 } from "lucide-react";
import { AdminModal } from "./AdminModal";
import { ApiError, apiFetch, apiFetchWithRetry } from "../../lib/api";
import type { FingerprintStatus, FingerprintStep } from "../../types/admin";

const POLL_INTERVAL_MS = 1500;

interface TeacherAttendanceForceModalProps {
  open: boolean;
  userId: string;
  professorName: string;
  onClose: () => void;
  onSuccess: () => void;
}

function stepMessage(step: FingerprintStep | null): string {
  switch (step) {
    case "requested":
      return "Esperando a que el ESP32 tome la solicitud…";
    case "claimed":
    case "place_finger":
      return "Coloque el dedo en el sensor";
    case "processing":
      return "Comparando huella…";
    case "success":
      return "¡Asistencia registrada!";
    case "error":
      return "No se pudo registrar la asistencia";
    default:
      return "Iniciando…";
  }
}

export function TeacherAttendanceForceModal({
  open,
  userId,
  professorName,
  onClose,
  onSuccess,
}: TeacherAttendanceForceModalProps) {
  const [status, setStatus] = useState<FingerprintStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const startSession = useCallback(async () => {
    if (!userId) return;
    setStarting(true);
    setError(null);
    try {
      await apiFetch(
        `/api/admin/asistencia-profesores/${userId}/marcar-forzada`,
        { method: "POST" }
      );
      const initial = await apiFetchWithRetry<FingerprintStatus>(
        `/api/admin/users/${userId}/huella/estado`
      );
      setStatus(initial);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "No se pudo iniciar la toma de huella"
      );
    } finally {
      setStarting(false);
    }
  }, [userId]);

  const cancelSession = useCallback(async () => {
    if (!userId) return;
    try {
      await apiFetch(`/api/admin/users/${userId}/huella/cancelar`, {
        method: "POST",
      });
    } catch {
      // ignore cancel errors
    }
  }, [userId]);

  const handleClose = useCallback(() => {
    void cancelSession();
    setStatus(null);
    setError(null);
    onClose();
  }, [cancelSession, onClose]);

  useEffect(() => {
    if (!open || !userId) return;
    setStatus(null);
    setError(null);
    void startSession();
  }, [open, userId, startSession]);

  useEffect(() => {
    if (!open || !userId || starting) return;

    const step = status?.step;
    if (step === "success" || step === "error") return;

    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const next = await apiFetchWithRetry<FingerprintStatus>(
          `/api/admin/users/${userId}/huella/estado`
        );
        if (cancelled) return;
        setStatus(next);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error al consultar estado");
        }
      }
    };

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [open, userId, starting, status?.step]);

  useEffect(() => {
    if (!open || status?.step !== "success") return;

    const timer = window.setTimeout(() => {
      onSuccess();
      onClose();
      setStatus(null);
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [open, status?.step, onSuccess, onClose]);

  if (!open) return null;

  const step = status?.step ?? null;
  const isSuccess = step === "success";
  const isError = step === "error" || Boolean(error);
  const displayError = status?.errorMessage ?? error;
  const showSpinner =
    !isSuccess &&
    !isError &&
    (starting || step === "requested" || step === "processing" || step === "claimed");

  return (
    <AdminModal
      open={open}
      title="Tomar Huella"
      error={isError ? displayError : null}
      onClose={handleClose}
      footer={
        <>
          {!isSuccess ? (
            <button
              type="button"
              className="project-modal__btn project-modal__btn--muted"
              onClick={handleClose}
            >
              Cancelar
            </button>
          ) : null}
          {isError ? (
            <button
              type="button"
              className="project-modal__btn project-modal__btn--primary"
              onClick={() => void startSession()}
              disabled={starting}
            >
              Reintentar
            </button>
          ) : null}
        </>
      }
    >
      <div className="fingerprint-modal">
        <div className="fingerprint-modal__user">
          <Fingerprint size={28} aria-hidden />
          <div>
            <p className="fingerprint-modal__name">{professorName}</p>
            {status?.slotId !== null && status?.slotId !== undefined ? (
              <p className="fingerprint-modal__slot">Slot del sensor: #{status.slotId}</p>
            ) : null}
          </div>
        </div>

        <div className="fingerprint-modal__step" role="status">
          {showSpinner ? (
            <Loader2 size={22} className="fingerprint-modal__spinner" aria-hidden />
          ) : (
            <Fingerprint
              size={22}
              className={
                isSuccess
                  ? "fingerprint-modal__icon fingerprint-modal__icon--success"
                  : "fingerprint-modal__icon"
              }
              aria-hidden
            />
          )}
          <p>{stepMessage(step)}</p>
        </div>

        <ol className="fingerprint-modal__steps">
          <li className={step === "requested" || step === "claimed" ? "is-active" : ""}>
            Conectar con el ESP32
          </li>
          <li className={step === "place_finger" ? "is-active" : ""}>
            Colocar el dedo en el sensor
          </li>
          <li className={step === "processing" || step === "success" ? "is-active" : ""}>
            Registrar la asistencia
          </li>
        </ol>
      </div>
    </AdminModal>
  );
}
