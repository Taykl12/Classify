import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Layers, Search, Users } from "lucide-react";
import { AdminAssignmentList } from "../../components/admin/AdminAssignmentList";
import { AdminModal } from "../../components/admin/AdminModal";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { ApiError, apiFetch, apiFetchWithRetry } from "../../lib/api";
import type {
  AdminProject,
  AdminProjectResponse,
  AdminProjectsResponse,
  AdminUser,
  AdminUsersResponse,
} from "../../types/admin";
import { ROUTES } from "../../routes";
import { Link } from "react-router-dom";
import "../../styles/admin.css";

interface ProjectFormState {
  name: string;
  status: "Abierto" | "Cerrado";
  preprojectValidated: boolean;
}

function emptyForm(): ProjectFormState {
  return {
    name: "",
    status: "Abierto",
    preprojectValidated: false,
  };
}

function projectToForm(project: AdminProject): ProjectFormState {
  return {
    name: project.name,
    status: project.status,
    preprojectValidated: Boolean(project.preprojectValidated),
  };
}

function filterProjects(projects: AdminProject[], query: string): AdminProject[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return projects;
  return projects.filter((project) =>
    [project.name, project.ownerEmail ?? "", project.status, project.createdAt]
      .join(" ")
      .toLowerCase()
      .includes(needle)
  );
}

function userLabel(user: AdminUser): string {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
}

export default function AdminProyectosPage() {
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectForm, setProjectForm] = useState<ProjectFormState>(emptyForm());
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [selectedProfessorIds, setSelectedProfessorIds] = useState<Set<string>>(new Set());

  const visibleProjects = useMemo(() => filterProjects(projects, query), [projects, query]);
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );
  const professors = useMemo(
    () => users.filter((user) => user.roleLabel.toLowerCase() === "profesor"),
    [users]
  );
  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  const loadData = useCallback(async () => {
    const [projectsData, usersData] = await Promise.all([
      apiFetchWithRetry<AdminProjectsResponse>("/api/admin/proyectos"),
      apiFetchWithRetry<AdminUsersResponse>("/api/admin/users"),
    ]);
    setProjects(projectsData.projects);
    setUsers(usersData.users);
    setSelectedProjectId((current) => {
      if (current && projectsData.projects.some((project) => project.id === current)) {
        return current;
      }
      return projectsData.projects[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadData()
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  useEffect(() => {
    if (!selectedProject) {
      setProjectForm(emptyForm());
      return;
    }
    setProjectForm(projectToForm(selectedProject));
  }, [selectedProject]);

  function professorNames(project: AdminProject): string {
    const names = project.assignedProfessorIds
      .map((id) => {
        const user = usersById.get(id);
        return user ? userLabel(user) : null;
      })
      .filter((name): name is string => Boolean(name));
    return names.length > 0 ? names.join(", ") : "Sin profesores asignados";
  }

  function openAssignments() {
    if (!selectedProject) return;
    setSelectedProfessorIds(new Set(selectedProject.assignedProfessorIds));
    setModalError(null);
    setAssignmentOpen(true);
  }

  function closeAssignments() {
    setAssignmentOpen(false);
    setModalError(null);
  }

  function toggleProfessor(id: string) {
    setSelectedProfessorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function refreshProject(id: string) {
    const data = await apiFetch<AdminProjectResponse>(`/api/admin/proyectos/${id}`);
    setProjects((prev) => prev.map((project) => (project.id === id ? data.project : project)));
  }

  async function handleSaveProject(event: FormEvent) {
    event.preventDefault();
    if (!selectedProject) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch<AdminProjectResponse>(`/api/admin/proyectos/${selectedProject.id}`, {
        method: "PUT",
        body: JSON.stringify(projectForm),
      });
      await refreshProject(selectedProject.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo guardar");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveAssignments() {
    if (!selectedProject) return;
    setSubmitting(true);
    setModalError(null);
    try {
      const data = await apiFetch<AdminProjectResponse>(
        `/api/admin/proyectos/${selectedProject.id}/profesores`,
        {
          method: "PUT",
          body: JSON.stringify({ professorIds: [...selectedProfessorIds] }),
        }
      );
      setProjects((prev) =>
        prev.map((project) => (project.id === selectedProject.id ? data.project : project))
      );
      closeAssignments();
    } catch (e) {
      setModalError(e instanceof ApiError ? e.message : "No se pudo asignar");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteProject() {
    if (!selectedProject) return;
    if (!window.confirm(`¿Eliminar el proyecto ${selectedProject.name}?`)) return;
    setError(null);
    try {
      await apiFetch<{ deleted: string }>(`/api/admin/proyectos/${selectedProject.id}`, {
        method: "DELETE",
      });
      await loadData();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo eliminar");
    }
  }

  return (
    <DashboardLayout>
      <header className="admin-page-header">
        <div>
          <p className="admin-page-header__eyebrow">Administración</p>
          <h1 className="admin-page-header__title">Gestión de Proyectos</h1>
          <p className="admin-page-header__subtitle">
            Administrá proyectos globalmente y asigná profesores supervisores.
          </p>
        </div>
      </header>

      <section className="dashboard-panel">
        {error ? (
          <p className="dashboard-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="admin-toolbar">
          <label className="admin-search">
            <Search size={18} aria-hidden />
            <span className="sr-only">Buscar proyectos</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, dueño o estado"
            />
          </label>
        </div>

        {loading ? (
          <div className="projects-table projects-table--empty" role="status">
            Cargando proyectos…
          </div>
        ) : visibleProjects.length === 0 ? (
          <div className="projects-table projects-table--empty" role="status">
            No hay proyectos para mostrar.
          </div>
        ) : (
          <div className="admin-course-layout">
            <aside className="admin-course-list" aria-label="Lista de proyectos">
              <div className="admin-course-list__header">
                <h2>Proyectos</h2>
                <span>{visibleProjects.length}</span>
              </div>
              <div className="admin-course-list__items">
                {visibleProjects.map((project) => {
                  const active = project.id === selectedProjectId;
                  return (
                    <button
                      key={project.id}
                      type="button"
                      className={`admin-course-card${active ? " admin-course-card--active" : ""}`}
                      onClick={() => setSelectedProjectId(project.id)}
                      aria-pressed={active}
                    >
                      <span className="admin-course-card__badge">
                        {project.status === "Cerrado" ? "C" : "A"}
                      </span>
                      <strong>{project.name}</strong>
                      <small>{project.ownerEmail ?? "Sin dueño"}</small>
                      <span className="admin-course-card__meta">
                        <Users size={14} aria-hidden />
                        {project.memberCount} integrantes
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <article className="admin-course-detail">
              {!selectedProject ? (
                <div className="admin-empty-detail">
                  <Layers size={42} aria-hidden />
                  <p>Seleccioná un proyecto para ver el detalle.</p>
                </div>
              ) : (
                <>
                  <div className="admin-course-detail__header">
                    <div className="admin-course-detail__title">
                      <span className="admin-course-detail__icon">
                        <Layers size={24} aria-hidden />
                      </span>
                      <div>
                        <h2>{selectedProject.name}</h2>
                        <p>
                          Dueño: {selectedProject.ownerEmail ?? "—"} — {selectedProject.status}
                        </p>
                      </div>
                    </div>
                    <div className="admin-course-detail__actions">
                      <Link
                        to={ROUTES.projectConfig(selectedProject.id)}
                        className="projects-panel__action-btn"
                      >
                        Abrir configuración
                      </Link>
                      <button
                        type="button"
                        className="projects-panel__action-btn"
                        onClick={openAssignments}
                      >
                        Asignar Profesores
                      </button>
                    </div>
                  </div>

                  <div className="admin-course-metrics" aria-label="Resumen del proyecto">
                    <div className="admin-course-metrics__card">
                      <div>
                        <span>Profesores asignados</span>
                        <strong>{selectedProject.assignedProfessorIds.length}</strong>
                        <small>{professorNames(selectedProject)}</small>
                      </div>
                    </div>
                    <div className="admin-course-metrics__card">
                      <div>
                        <span>Integrantes</span>
                        <strong>{selectedProject.memberCount}</strong>
                      </div>
                    </div>
                  </div>

                  <form className="admin-form admin-course-subjects" onSubmit={handleSaveProject}>
                    <div className="admin-course-subjects__header">
                      <h3>Editar proyecto</h3>
                    </div>
                    <p className="admin-form__hint">
                      Alcance, documentación, bloqueos por sección y más se gestionan en{" "}
                      <Link to={ROUTES.projectConfig(selectedProject.id)}>configuración del proyecto</Link>.
                    </p>
                    <label className="project-modal__label">
                      Nombre
                      <input
                        type="text"
                        className="project-modal__input"
                        value={projectForm.name}
                        onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                        required
                      />
                    </label>
                    <label className="project-modal__label">
                      Estado
                      <select
                        className="project-modal__input"
                        value={projectForm.status}
                        onChange={(e) =>
                          setProjectForm({
                            ...projectForm,
                            status: e.target.value as "Abierto" | "Cerrado",
                          })
                        }
                      >
                        <option value="Abierto">Abierto</option>
                        <option value="Cerrado">Cerrado</option>
                      </select>
                    </label>
                    <label className="project-config__checkbox-row">
                      <input
                        type="checkbox"
                        checked={projectForm.preprojectValidated}
                        onChange={(e) =>
                          setProjectForm({
                            ...projectForm,
                            preprojectValidated: e.target.checked,
                          })
                        }
                      />
                      Anteproyecto validado
                    </label>
                    <button
                      type="submit"
                      className="projects-panel__action-btn projects-panel__action-btn--primary"
                      disabled={submitting}
                    >
                      {submitting ? "Guardando…" : "Guardar cambios"}
                    </button>
                  </form>

                  <div className="admin-course-detail__footer">
                    <button
                      type="button"
                      className="projects-panel__action-btn admin-table__danger"
                      onClick={handleDeleteProject}
                    >
                      Eliminar Proyecto
                    </button>
                  </div>
                </>
              )}
            </article>
          </div>
        )}
      </section>

      <AdminModal
        open={assignmentOpen}
        title={`Asignar profesores${selectedProject ? ` a ${selectedProject.name}` : ""}`}
        error={modalError}
        onClose={closeAssignments}
        footer={
          <>
            <button
              type="button"
              className="project-modal__btn project-modal__btn--muted"
              onClick={closeAssignments}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="project-modal__btn project-modal__btn--primary"
              onClick={handleSaveAssignments}
              disabled={submitting}
            >
              {submitting ? "Guardando…" : "Guardar"}
            </button>
          </>
        }
      >
        <AdminAssignmentList
          title="Profesores del proyecto"
          searchable
          searchPlaceholder="Buscar profesor por nombre o correo"
          options={professors.map((professor) => ({
            id: professor.id,
            label: userLabel(professor),
            detail: professor.email,
            searchText: [professor.firstName, professor.lastName, professor.email].join(" "),
          }))}
          selectedIds={selectedProfessorIds}
          emptyText="No hay profesores disponibles."
          onToggle={toggleProfessor}
          resetKey={selectedProject?.id}
        />
      </AdminModal>
    </DashboardLayout>
  );
}
