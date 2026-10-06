import { useEffect, useState } from "react";
import { AdminModal } from "./AdminModal";
import { ApiError, apiFetch, apiFetchWithRetry } from "../../lib/api";
import type { TeacherAttendanceConfig } from "../../types/admin";

interface TeacherAttendanceConfigModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const WORKDAYS: Array<{ value: number; label: string }> = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
  { value: 7, label: "Dom" },
];

function parseIntOr(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function TeacherAttendanceConfigModal({
  open,
  onClose,
  onSaved,
}: TeacherAttendanceConfigModalProps) {
  const [config, setConfig] = useState<TeacherAttendanceConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setConfig(null);
    setError(null);
    apiFetchWithRetry<{ config: TeacherAttendanceConfig }>(
      "/api/admin/asistencia-profesores/config"
    )
      .then((response) => {
        if (!cancelled) setConfig(response.config);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar");
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function toggleWorkday(day: number) {
    setConfig((prev) => {
      if (!prev) return prev;
      const has = prev.diasLaborables.includes(day);
      const next = has
        ? prev.diasLaborables.filter((item) => item !== day)
        : [...prev.diasLaborables, day].sort((a, b) => a - b);
      return { ...prev, diasLaborables: next };
    });
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch<{ config: TeacherAttendanceConfig }>(
        "/api/admin/asistencia-profesores/config",
        { method: "PUT", body: JSON.stringify(config) }
      );
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminModal
      open={open}
      title="Configuración de asistencia"
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
            type="button"
            className="project-modal__btn project-modal__btn--primary"
            onClick={() => void handleSave()}
            disabled={saving || !config}
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </>
      }
    >
      {config ? (
        <div className="admin-form">
          <div className="admin-form__row">
            <label className="project-modal__label">
              Hora de entrada esperada
              <input
                type="time"
                className="project-modal__input"
                value={config.horaEntrada}
                onChange={(e) => setConfig({ ...config, horaEntrada: e.target.value })}
              />
            </label>
            <label className="project-modal__label">
              Tolerancia (min)
              <input
                type="number"
                min={0}
                max={240}
                className="project-modal__input"
                value={config.toleranciaMinutos}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    toleranciaMinutos: parseIntOr(e.target.value, config.toleranciaMinutos),
                  })
                }
              />
            </label>
          </div>

          <label className="project-modal__label">
            Minutos tras la entrada para considerar Ausente
            <input
              type="number"
              min={0}
              max={720}
              className="project-modal__input"
              value={config.minutosAusencia}
              onChange={(e) =>
                setConfig({
                  ...config,
                  minutosAusencia: parseIntOr(e.target.value, config.minutosAusencia),
                })
              }
            />
          </label>

          <fieldset className="teacher-attendance-workdays">
            <legend>Días laborables</legend>
            <div className="teacher-attendance-workdays__list">
              {WORKDAYS.map((day) => (
                <label key={day.value}>
                  <input
                    type="checkbox"
                    checked={config.diasLaborables.includes(day.value)}
                    onChange={() => toggleWorkday(day.value)}
                  />
                  <span>{day.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      ) : (
        <p className="teacher-attendance-detail__status" role="status">
          Cargando configuración…
        </p>
      )}
    </AdminModal>
  );
}
