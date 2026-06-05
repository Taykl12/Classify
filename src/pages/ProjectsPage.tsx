import { useCallback, useEffect, useState } from "react";
import { Laptop } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ProjectFormModal } from "../components/projects/ProjectFormModal";
import { ProjectsListSection } from "../components/projects/ProjectsListSection";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { ApiError, apiFetch } from "../lib/api";
import { ROUTES } from "../routes";
import type { ProjectDetail, ProjectFormValues, ProjectListItem } from "../types/projects";
import { EMPTY_PROJECT_FORM } from "../types/projects";
import "../styles/dashboard.css";
import "../styles/projects-page.css";

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ProjectListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadProjects = useCallback(async () => {
    setError(null);
    const data = await apiFetch<ProjectListItem[]>("/api/projects");
    setItems(data);
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (data.some((p) => p.id === id)) next.add(id);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadProjects();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadProjects]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (items.every((i) => selectedIds.has(i.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  }

  function openCreate() {
    setModalError(null);
    setCreateOpen(true);
  }

  function openEdit(item: ProjectListItem) {
    navigate(ROUTES.projectConfig(item.id));
  }

  function closeModal() {
    setCreateOpen(false);
    setModalError(null);
  }

  async function handleFormSubmit(values: ProjectFormValues) {
    setModalError(null);
    setSubmitting(true);
    try {
      await apiFetch<ProjectDetail>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name: values.name,
          memberEmails: values.memberEmails,
        }),
      });
      await loadProjects();
      closeModal();
    } catch (e) {
      setModalError(e instanceof ApiError ? e.message : "No se pudo guardar");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleFavorite(item: ProjectListItem) {
    setError(null);
    try {
      const updated = await apiFetch<ProjectListItem>(`/api/projects/${item.id}/favorite`, {
        method: "PATCH",
        body: JSON.stringify({ isFavorite: !item.isFavorite }),
      });
      setItems((list) => list.map((p) => (p.id === updated.id ? updated : p)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo actualizar favorito");
    }
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) {
      setError("Seleccioná al menos un proyecto para borrar");
      return;
    }
    const count = selectedIds.size;
    if (!window.confirm(`¿Borrar ${count} proyecto${count > 1 ? "s" : ""}?`)) return;
    setError(null);
    try {
      await apiFetch<{ deleted: string[] }>("/api/projects/bulk", {
        method: "DELETE",
        body: JSON.stringify({ ids: [...selectedIds] }),
      });
      setSelectedIds(new Set());
      await loadProjects();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo borrar");
    }
  }

  return (
    <DashboardLayout>
      <header className="projects-page__hero">
        <Laptop size={52} strokeWidth={2.25} className="projects-page__hero-icon" aria-hidden />
        <h1 id="projects-page-title" className="projects-page__hero-title">
          Mis Proyectos
        </h1>
      </header>
      <section className="dashboard-panel" aria-labelledby="projects-page-title">
        {error ? (
          <p className="dashboard-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="projects-panel__toolbar">
          <div className="projects-panel__actions">
            <button
              type="button"
              className="projects-panel__action-btn"
              onClick={handleDeleteSelected}
              disabled={loading || selectedIds.size === 0}
            >
              Borrar Proyecto
            </button>
            <button
              type="button"
              className="projects-panel__action-btn projects-panel__action-btn--primary"
              onClick={openCreate}
              disabled={loading}
            >
              Crear Proyecto
            </button>
          </div>
        </div>
        <ProjectsListSection
          items={items}
          isLoading={loading}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onEdit={openEdit}
          onToggleFavorite={handleToggleFavorite}
        />
      </section>

      <ProjectFormModal
        open={createOpen}
        mode="create"
        initialValues={EMPTY_PROJECT_FORM}
        submitting={submitting}
        error={modalError}
        onClose={closeModal}
        onSubmit={handleFormSubmit}
      />
    </DashboardLayout>
  );
}
