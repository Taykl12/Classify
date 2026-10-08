import { useEffect, useState, type FormEvent } from "react";
import { AdminModal } from "../admin/AdminModal";
import { apiFetch, ApiError } from "../../lib/api";
import { TASK_PRIORITIES, type Task, type TaskPriority } from "../../types/tasks";

interface TaskFormModalProps {
  open: boolean;
  projectId: string;
  task: Task | null;
  onClose: () => void;
  onSaved: () => void;
}

export function TaskFormModal({ open, projectId, task, onClose, onSaved }: TaskFormModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("Media");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setPriority(task?.priority ?? "Media");
    setDeadline(task?.deadline ?? "");
    setError(null);
  }, [open, task]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("El título es obligatorio");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (task) {
        await apiFetch(`/api/tasks/${task.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            priority,
            deadline: deadline || null,
          }),
        });
      } else {
        await apiFetch("/api/tasks", {
          method: "POST",
          body: JSON.stringify({
            projectId,
            title: title.trim(),
            description: description.trim() || undefined,
            priority,
            deadline: deadline || null,
          }),
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la tarea");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminModal
      open={open}
      title={task ? "Editar tarea" : "Nueva tarea"}
      error={error}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="project-modal__btn project-modal__btn--muted" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            form="task-form"
            className="project-modal__btn project-modal__btn--primary"
            disabled={saving}
          >
            {saving ? "Guardando…" : task ? "Guardar" : "Crear tarea"}
          </button>
        </>
      }
    >
      <form id="task-form" className="admin-form" onSubmit={handleSubmit}>
        <label className="project-modal__label">
          Título
          <input
            type="text"
            className="project-modal__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={150}
            required
            autoFocus
          />
        </label>
        <label className="project-modal__label">
          Descripción
          <textarea
            className="project-modal__input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={5000}
            placeholder="Detalle opcional"
          />
        </label>
        <div className="admin-form__row">
          <label className="project-modal__label">
            Prioridad
            <select
              className="project-modal__input"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
            >
              {TASK_PRIORITIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="project-modal__label">
            Fecha límite (opcional)
            <input
              type="date"
              className="project-modal__input"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>
        </div>
      </form>
    </AdminModal>
  );
}
