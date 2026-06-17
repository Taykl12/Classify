import { useEffect, useRef, useState } from "react";
import { apiFetchWithRetry } from "../../lib/api";
import type { ProjectListItem } from "../../types/projects";

interface EventFormModalProps {
  eventDate: string;
  onClose: () => void;
  onEventCreated: () => void;
}

export default function EventFormModal({ eventDate, onClose, onEventCreated }: EventFormModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Media");
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetchWithRetry<ProjectListItem[]>("/api/projects");
        setProjects(data);
      } catch {
        // silently fail — dropdown will be empty
      }
    })();
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !projectId) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetchWithRetry("/api/calendar/events", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          eventDate,
        }),
      });
      onEventCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear evento");
    } finally {
      setSaving(false);
    }
  }

  const formattedDate = new Date(`${eventDate}T12:00:00`).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="day-events-overlay" onClick={onClose}>
      <div
        className="task-form-modal"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Nuevo evento"
      >
        <div className="task-form-modal__header">
          <h3>Nuevo evento</h3>
          <button type="button" className="calendar-btn calendar-btn--nav" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <form className="task-form" onSubmit={handleSubmit}>
          <p className="task-form__date-hint">{formattedDate}</p>
          <div className="task-form__field">
            <label htmlFor="event-title">Título</label>
            <input
              id="event-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
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
            >
              <option value="">Seleccionar proyecto</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="task-form__field">
            <label htmlFor="event-desc">Descripción</label>
            <textarea
              id="event-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
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
          {error ? <p className="task-form__error" role="alert">{error}</p> : null}
          <div className="task-form__actions">
            <button type="button" className="calendar-btn calendar-btn--today" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className="calendar-btn calendar-btn--today task-form__submit"
              disabled={saving || !title.trim() || !projectId}
            >
              {saving ? "Guardando…" : "Crear evento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
