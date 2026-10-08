import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ListTodo, Plus, Search } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { TaskFormModal } from "../components/tasks/TaskFormModal";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch, apiFetchWithRetry, isUnauthorizedError } from "../lib/api";
import { ROUTES } from "../routes";
import type { ProjectDetail } from "../types/projects";
import {
  TASK_STATUSES,
  type Task,
  type TaskStatus,
  type TasksResponse,
} from "../types/tasks";
import "../styles/project-tasks.css";

const STATUS_BADGE: Record<TaskStatus, string> = {
  Pendiente: "task-status-badge task-status-badge--pendiente",
  "En Progreso": "task-status-badge task-status-badge--progreso",
  Completado: "task-status-badge task-status-badge--completado",
};

const PRIORITY_BADGE: Record<string, string> = {
  Alta: "task-priority-badge task-priority-badge--alta",
  Media: "task-priority-badge task-priority-badge--media",
  Baja: "task-priority-badge task-priority-badge--baja",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function ProjectTasksPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [projectName, setProjectName] = useState("Proyecto");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "">("");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    const [detail, tasksResponse] = await Promise.all([
      apiFetchWithRetry<ProjectDetail>(`/api/projects/${projectId}`),
      apiFetchWithRetry<TasksResponse>(`/api/tasks/${projectId}`),
    ]);
    setProjectName(detail.name || "Proyecto");
    setTasks(tasksResponse.tasks);
  }, [projectId]);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    load()
      .catch((e) => {
        if (!cancelled && !isUnauthorizedError(e)) {
          setError(e instanceof Error ? e.message : "No se pudieron cargar las tareas");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, load]);

  const visibleTasks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (statusFilter && task.status !== statusFilter) return false;
      if (!needle) return true;
      return `${task.title} ${task.description}`.toLowerCase().includes(needle);
    });
  }, [tasks, statusFilter, query]);

  const summary = useMemo(
    () => ({
      total: tasks.length,
      pendientes: tasks.filter((t) => t.status === "Pendiente").length,
      enProgreso: tasks.filter((t) => t.status === "En Progreso").length,
      completadas: tasks.filter((t) => t.status === "Completado").length,
    }),
    [tasks]
  );

  function openCreate() {
    setEditingTask(null);
    setFormOpen(true);
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setFormOpen(true);
  }

  async function changeStatus(task: Task, status: TaskStatus) {
    setError(null);
    const previous = task.status;
    setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, status } : t)));
    try {
      await apiFetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    } catch (e) {
      setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, status: previous } : t)));
      setError(e instanceof Error ? e.message : "No se pudo cambiar el estado");
    }
  }

  async function handleDelete(task: Task) {
    if (!window.confirm(`¿Eliminar la tarea "${task.title}"?`)) return;
    setError(null);
    try {
      await apiFetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      setTasks((list) => list.filter((t) => t.id !== task.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar la tarea");
    }
  }

  return (
    <>
      <header className="admin-hero">
        <ListTodo size={52} strokeWidth={2.25} className="admin-hero__icon" aria-hidden />
        <div>
          <p className="admin-hero__eyebrow">Proyecto</p>
          <h1 className="admin-hero__title">Tareas — {projectName}</h1>
        </div>
      </header>

      <section className="dashboard-panel">
        <div className="projects-tasks__topbar">
          <Link to={ROUTES.PROJECTS} className="projects-tasks__back">
            <ArrowLeft size={18} aria-hidden /> Volver a proyectos
          </Link>
          <div className="projects-tasks__summary">
            <span>{summary.total} total</span>
            <span>{summary.pendientes} pendientes</span>
            <span>{summary.enProgreso} en progreso</span>
            <span>{summary.completadas} completadas</span>
          </div>
        </div>

        {error ? (
          <p className="dashboard-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="admin-toolbar">
          <label className="admin-search">
            <Search size={18} aria-hidden />
            <span className="sr-only">Buscar tareas</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar tareas"
            />
          </label>
          <label className="projects-tasks__filter">
            <span className="sr-only">Filtrar por estado</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TaskStatus | "")}
            >
              <option value="">Todos los estados</option>
              {TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="projects-panel__action-btn projects-panel__action-btn--primary"
            onClick={openCreate}
            disabled={loading}
          >
            <Plus size={16} aria-hidden /> Crear tarea
          </button>
        </div>

        {loading ? (
          <div className="projects-table projects-table--empty" role="status">
            Cargando tareas…
          </div>
        ) : visibleTasks.length === 0 ? (
          <div className="projects-table projects-table--empty" role="status">
            No hay tareas para mostrar.
          </div>
        ) : (
          <div className="projects-table-wrapper">
            <table className="projects-table admin-table">
              <thead>
                <tr>
                  <th scope="col">Tarea</th>
                  <th scope="col">Prioridad</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Fecha límite</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleTasks.map((task) => (
                  <tr key={task.id}>
                    <td className="projects-table__cell projects-table__cell--name" data-label="Tarea">
                      {task.title}
                      {task.description ? (
                        <small className="admin-table__subtext">{task.description}</small>
                      ) : null}
                    </td>
                    <td className="projects-table__cell" data-label="Prioridad">
                      <span className={PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.Media}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="projects-table__cell" data-label="Estado">
                      <label className="projects-tasks__status">
                        <span className="sr-only">Estado de {task.title}</span>
                        <span className={STATUS_BADGE[task.status]}>{task.status}</span>
                        <select
                          value={task.status}
                          onChange={(e) => void changeStatus(task, e.target.value as TaskStatus)}
                          aria-label={`Cambiar estado de ${task.title}`}
                        >
                          {TASK_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                    </td>
                    <td className="projects-table__cell projects-table__cell--muted" data-label="Fecha límite">
                      {formatDate(task.deadline)}
                    </td>
                    <td
                      className="projects-table__cell projects-table__cell--actions"
                      data-label="Acciones"
                    >
                      <button
                        type="button"
                        className="projects-table__action"
                        onClick={() => openEdit(task)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="projects-table__action admin-table__danger"
                        onClick={() => void handleDelete(task)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <TaskFormModal
        open={formOpen}
        projectId={projectId ?? ""}
        task={editingTask}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          void load();
        }}
      />
    </>
  );
}
