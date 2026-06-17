import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { BookOpen, Search } from "lucide-react";
import { AdminAssignmentList } from "../../components/admin/AdminAssignmentList";
import { AdminModal } from "../../components/admin/AdminModal";
import { AdminSubjectScheduleFields } from "../../components/admin/AdminSubjectScheduleFields";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { ApiError, apiFetch, apiFetchWithRetry } from "../../lib/api";
import { composeHorario, emptyParsedHorario, parseHorario } from "../../lib/adminAcademic";
import type { ScheduleSlot } from "../../lib/adminAcademic";
import type {
  AdminCourse,
  AdminCoursesResponse,
  AdminSubject,
  AdminSubjectsResponse,
  AdminUser,
  AdminUsersResponse,
} from "../../types/admin";
import "../../styles/admin.css";

interface SubjectFormState {
  name: string;
  courseId: string;
  scheduleSlots: ScheduleSlot[];
}

function emptySubjectForm(): SubjectFormState {
  return {
    name: "",
    courseId: "",
    scheduleSlots: emptyParsedHorario().slots,
  };
}

const EMPTY_SUBJECT_FORM: SubjectFormState = emptySubjectForm();

function subjectToForm(subject: AdminSubject): SubjectFormState {
  const parsed = parseHorario(subject.horario);
  return {
    name: subject.name,
    courseId: subject.courseId,
    scheduleSlots: parsed.slots,
  };
}

function filterSubjects(subjects: AdminSubject[], query: string): AdminSubject[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return subjects;
  return subjects.filter((subject) =>
    [subject.name, subject.courseName].join(" ").toLowerCase().includes(needle)
  );
}

function userLabel(user: AdminUser): string {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
}

export default function AdminMateriasPage() {
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [professors, setProfessors] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<AdminSubject | null>(null);
  const [assignmentSubject, setAssignmentSubject] = useState<AdminSubject | null>(null);
  const [form, setForm] = useState<SubjectFormState>(EMPTY_SUBJECT_FORM);
  const [selectedProfessorIds, setSelectedProfessorIds] = useState<Set<string>>(new Set());

  const visibleSubjects = useMemo(() => filterSubjects(subjects, query), [subjects, query]);

  const loadData = useCallback(async () => {
    const [subjectsData, coursesData, usersData] = await Promise.all([
      apiFetchWithRetry<AdminSubjectsResponse>("/api/admin/materias"),
      apiFetchWithRetry<AdminCoursesResponse>("/api/admin/cursos"),
      apiFetchWithRetry<AdminUsersResponse>("/api/admin/users"),
    ]);
    setSubjects(subjectsData.subjects);
    setCourses(coursesData.courses);
    setProfessors(
      usersData.users.filter((user) => user.roleLabel.trim().toLowerCase() === "profesor")
    );
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

  function openCreate() {
    setEditingSubject(null);
    setForm({
      ...EMPTY_SUBJECT_FORM,
      courseId: courses[0]?.id ?? "",
    });
    setModalError(null);
    setFormOpen(true);
  }

  function openEdit(subject: AdminSubject) {
    setEditingSubject(subject);
    setForm(subjectToForm(subject));
    setModalError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingSubject(null);
    setModalError(null);
  }

  function openAssignments(subject: AdminSubject) {
    setAssignmentSubject(subject);
    setSelectedProfessorIds(new Set(subject.professorIds));
    setModalError(null);
    setAssignmentOpen(true);
  }

  function closeAssignments() {
    setAssignmentOpen(false);
    setAssignmentSubject(null);
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setModalError(null);
    const payload = {
      name: form.name,
      courseId: Number(form.courseId),
      horario: composeHorario(form.scheduleSlots),
    };
    try {
      if (editingSubject) {
        await apiFetch<{ subject: AdminSubject }>(`/api/admin/materias/${editingSubject.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch<{ subject: AdminSubject }>("/api/admin/materias", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      await loadData();
      closeForm();
    } catch (e) {
      setModalError(e instanceof ApiError ? e.message : "No se pudo guardar");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveAssignments() {
    if (!assignmentSubject) return;
    setSubmitting(true);
    setModalError(null);
    try {
      await apiFetch<{ subject: AdminSubject }>(
        `/api/admin/materias/${assignmentSubject.id}/profesores`,
        {
          method: "PUT",
          body: JSON.stringify({ professorIds: [...selectedProfessorIds] }),
        }
      );
      await loadData();
      closeAssignments();
    } catch (e) {
      setModalError(e instanceof ApiError ? e.message : "No se pudo asignar");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(subject: AdminSubject) {
    if (!window.confirm(`¿Eliminar la materia ${subject.name}?`)) return;
    setError(null);
    try {
      await apiFetch<{ deleted: string }>(`/api/admin/materias/${subject.id}`, {
        method: "DELETE",
      });
      await loadData();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo eliminar");
    }
  }

  return (
    <DashboardLayout>
      <header className="admin-hero">
        <BookOpen size={52} strokeWidth={2.25} className="admin-hero__icon" aria-hidden />
        <div>
          <p className="admin-hero__eyebrow">Administración</p>
          <h1 className="admin-hero__title">Materias</h1>
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
            <span className="sr-only">Buscar materias</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por materia o curso"
            />
          </label>
          <button
            type="button"
            className="projects-panel__action-btn projects-panel__action-btn--primary"
            onClick={openCreate}
            disabled={loading || courses.length === 0}
          >
            Crear Materia
          </button>
        </div>

        {loading ? (
          <div className="projects-table projects-table--empty" role="status">
            Cargando materias…
          </div>
        ) : visibleSubjects.length === 0 ? (
          <div className="projects-table projects-table--empty" role="status">
            No hay materias para mostrar.
          </div>
        ) : (
          <div className="projects-table-wrapper">
            <table className="projects-table admin-table">
              <thead>
                <tr>
                  <th scope="col">Materia</th>
                  <th scope="col">Curso</th>
                  <th scope="col">Horario</th>
                  <th scope="col">Profesores</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleSubjects.map((subject) => (
                  <tr key={subject.id}>
                    <td className="projects-table__cell projects-table__cell--name" data-label="Materia">
                      {subject.name}
                    </td>
                    <td className="projects-table__cell projects-table__cell--muted" data-label="Curso">
                      {subject.courseName}
                    </td>
                    <td className="projects-table__cell projects-table__cell--muted" data-label="Horario">
                      {subject.horario || "—"}
                    </td>
                    <td className="projects-table__cell" data-label="Profesores">
                      {subject.professorIds.length}
                    </td>
                    <td className="projects-table__cell projects-table__cell--actions" data-label="Acciones">
                      <button
                        type="button"
                        className="projects-table__action"
                        onClick={() => openAssignments(subject)}
                      >
                        Asignar
                      </button>
                      <button
                        type="button"
                        className="projects-table__action"
                        onClick={() => openEdit(subject)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="projects-table__action admin-table__danger"
                        onClick={() => handleDelete(subject)}
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

      <AdminModal
        open={formOpen}
        title={editingSubject ? "Editar materia" : "Crear materia"}
        error={modalError}
        onClose={closeForm}
        footer={
          <>
            <button
              type="button"
              className="project-modal__btn project-modal__btn--muted"
              onClick={closeForm}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="admin-subject-form"
              className="project-modal__btn project-modal__btn--primary"
              disabled={submitting}
            >
              {submitting ? "Guardando…" : "Guardar"}
            </button>
          </>
        }
      >
        <form id="admin-subject-form" className="admin-form" onSubmit={handleSubmit}>
          <label className="project-modal__label">
            Nombre de la materia
            <input
              type="text"
              className="project-modal__input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label className="project-modal__label">
            Curso
            <select
              className="project-modal__input"
              value={form.courseId}
              onChange={(e) => setForm({ ...form, courseId: e.target.value })}
              required
            >
              <option value="">Seleccionar curso</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>
          <AdminSubjectScheduleFields
            slots={form.scheduleSlots}
            onSlotsChange={(scheduleSlots) => setForm({ ...form, scheduleSlots })}
          />
        </form>
      </AdminModal>

      <AdminModal
        open={assignmentOpen}
        title={`Asignar profesores${assignmentSubject ? ` a ${assignmentSubject.name}` : ""}`}
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
          title="Profesores de la materia"
          options={professors.map((item) => ({
            id: item.id,
            label: userLabel(item),
            detail: item.email || "Sin email",
          }))}
          selectedIds={selectedProfessorIds}
          emptyText="No hay profesores disponibles."
          onToggle={toggleProfessor}
        />
      </AdminModal>
    </DashboardLayout>
  );
}
