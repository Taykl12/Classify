import { useEffect, useRef, useState } from "react";
import { apiFetchWithRetry } from "../../lib/api";
import type { ProjectListItem } from "../../types/projects";

interface TaskFormModalProps {
  defaultDate: string | null;
  onClose: () => void;
  onTaskCreated: () => void;
}

export default function TaskFormModal({ defaultDate, onClose, onTaskCreated }: TaskFormModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Media");
  const [deadline, setDeadline] = useState(defaultDate ?? "");
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
      await apiFetchWithRetry("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          deadline: deadline || undefined,
        }),
      });
      onTaskCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear tarea");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="day-events-overlay" onClick={onClose}>
      <div
        className="task-form-modal"
        onClick={(e) => e.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Nueva tarea"
      >
        <div className="task-form-modal__header">
          <h3>Nueva tarea</h3>
          <button type="button" className="calendar-btn calendar-btn--nav" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <form className="task-form" onSubmit={handleSubmit}>
          <div className="task-form__field">
            <label htmlFor="task-title">Título</label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Ej: Terminar informe"
              autoFocus
            />
          </div>
          <div className="task-form__field">
            <label htmlFor="task-project">Proyecto</label>
            <select
              id="task-project"
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
            <label htmlFor="task-desc">Descripción</label>
            <textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Detalles opcionales"
            />
          </div>
          <div className="task-form__row">
            <div className="task-form__field">
              <label htmlFor="task-priority">Prioridad</label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="Baja">Baja</option>
                <option value="Media">Media</option>
                <option value="Alta">Alta</option>
              </select>
            </div>
            <div className="task-form__field">
              <label htmlFor="task-deadline">Fecha límite</label>
              <input
                id="task-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
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
              {saving ? "Guardando…" : "Crear tarea"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
