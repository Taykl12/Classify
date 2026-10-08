import { useEffect, useMemo, useState, type FormEvent } from "react";
import { apiFetchWithRetry } from "../../lib/api";
import { useModalEscape } from "../../hooks/useModalEscape";
import type { CalendarEvent } from "../../types/calendar";
import type { ProjectListItem } from "../../types/projects";

interface EventFormModalProps {
  mode: "create" | "edit";
  eventDate: string;
  event?: CalendarEvent | null;
  onClose: () => void;
  onSaved: () => void;
}

function formatDateLabel(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function EventFormModal({
  mode,
  eventDate,
  event,
  onClose,
  onSaved,
}: EventFormModalProps) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [priority, setPriority] = useState<string>(event?.priority ?? "Media");
  const [projectId, setProjectId] = useState(event?.projectId ?? "");
  const [date, setDate] = useState(event?.date ?? eventDate);
  const [horaInicio, setHoraInicio] = useState(event?.horaInicio ?? "");
  const [horaFin, setHoraFin] = useState(event?.horaFin ?? "");
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useModalEscape(true, onClose);

  useEffect(() => {
    let cancelled = false;
    apiFetchWithRetry<ProjectListItem[]>("/api/projects?scope=all")
      .then((data) => {
        if (!cancelled) setProjects(data);
      })
      .catch(() => {
        /* el select queda vacío si falla */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const timeError = useMemo(() => {
    if (horaInicio && horaFin && horaFin <= horaInicio) {
      return "La hora de fin debe ser posterior a la de inicio";
    }
    return null;
  }, [horaInicio, horaFin]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !projectId) return;
    if (timeError) {
      setError(timeError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (mode === "edit" && event) {
        await apiFetchWithRetry(`/api/calendar/events/${event.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            priority,
            eventDate: date,
            horaInicio: horaInicio || null,
            horaFin: horaFin || null,
          }),
        });
      } else {
        await apiFetchWithRetry("/api/calendar/events", {
          method: "POST",
          body: JSON.stringify({
            projectId,
            title: title.trim(),
            description: description.trim() || undefined,
            priority,
            eventDate: date,
            horaInicio: horaInicio || null,
            horaFin: horaFin || null,
          }),
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el evento");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="day-events-overlay" onClick={onClose}>
      <div
        className="task-form-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={mode === "edit" ? "Editar evento" : "Nuevo evento"}
      >
        <div className="task-form-modal__header">
          <h3>{mode === "edit" ? "Editar evento" : "Nuevo evento"}</h3>
          <button
            type="button"
            className="calendar-btn calendar-btn--nav"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <form className="task-form" onSubmit={handleSubmit}>
          <p className="task-form__date-hint">{formatDateLabel(date)}</p>
          <div className="task-form__field">
            <label htmlFor="event-title">Título</label>
            <input
              id="event-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={150}
              placeholder="Ej: Reunión de equipo"
              autoFocus
            />
          </div>
          <div className="task-form__field">
            <label htmlFor="event-project">Proyecto</label>
            <select
              id="event-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              required
              disabled={mode === "edit"}
            >
              <option value="">Seleccionar proyecto</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {mode === "edit" ? (
              <span className="task-form__date-hint">
                El proyecto no se puede cambiar al editar.
              </span>
            ) : null}
          </div>
          <div className="task-form__field">
            <label htmlFor="event-date">Fecha</label>
            <input
              id="event-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="task-form__row">
            <div className="task-form__field">
              <label htmlFor="event-start">Hora de inicio</label>
              <input
                id="event-start"
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
              />
            </div>
            <div className="task-form__field">
              <label htmlFor="event-end">Hora de fin</label>
              <input
                id="event-end"
                type="time"
                value={horaFin}
                onChange={(e) => setHoraFin(e.target.value)}
                aria-invalid={Boolean(timeError)}
              />
            </div>
          </div>
          <div className="task-form__field">
            <label htmlFor="event-desc">Descripción</label>
            <textarea
              id="event-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={5000}
              placeholder="Detalles opcionales"
            />
          </div>
          <div className="task-form__field">
            <label htmlFor="event-priority">Prioridad</label>
            <select
              id="event-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="Baja">Baja</option>
              <option value="Media">Media</option>
              <option value="Alta">Alta</option>
            </select>
          </div>
          {error || timeError ? (
            <p className="task-form__error" role="alert">
              {error ?? timeError}
            </p>
          ) : null}
          <div className="task-form__actions">
            <button type="button" className="calendar-btn calendar-btn--today" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className="calendar-btn calendar-btn--today task-form__submit"
              disabled={saving || !title.trim() || !projectId || Boolean(timeError)}
            >
              {saving ? "Guardando…" : mode === "edit" ? "Guardar cambios" : "Crear evento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
