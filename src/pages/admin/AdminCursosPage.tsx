import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { BookOpen, GraduationCap, Search, SquareArrowOutUpRight } from "lucide-react";
import { AdminAssignmentList } from "../../components/admin/AdminAssignmentList";
import { AdminModal } from "../../components/admin/AdminModal";
import { AdminSubjectScheduleFields } from "../../components/admin/AdminSubjectScheduleFields";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { ApiError, apiFetch, apiFetchWithRetry } from "../../lib/api";
import {
  YEAR_OPTIONS,
  SUPERIOR_ORIENTATION_OPTIONS,
  composeCoursePreview,
  composeHorario,
  courseCycleLabel,
  displayYearForInternalYear,
  divisionOptionsForYear,
  emptyParsedHorario,
  isSuperiorYear,
  normalizeDivisionForYear,
  normalizeSpecialty,
  parseHorario,
  yearSelectLabel,
} from "../../lib/adminAcademic";
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

interface CourseFormState {
  year: string;
  division: string;
  specialty: string;
}

interface SubjectFormState {
  name: string;
  courseId: string;
  scheduleSlots: ScheduleSlot[];
}

const EMPTY_COURSE_FORM: CourseFormState = {
  year: "1",
  division: divisionOptionsForYear(1)[0],
  specialty: "",
};

function emptySubjectForm(): SubjectFormState {
  return {
    name: "",
    courseId: "",
    scheduleSlots: emptyParsedHorario().slots,
  };
}

const EMPTY_SUBJECT_FORM: SubjectFormState = emptySubjectForm();

function courseToForm(course: AdminCourse): CourseFormState {
  const year = course.year || YEAR_OPTIONS[0];
  return {
    year: String(year),
    division: normalizeDivisionForYear(course.division, year),
    specialty: isSuperiorYear(year) ? normalizeSpecialty(course.specialty) : "",
  };
}

function subjectToForm(subject: AdminSubject): SubjectFormState {
  const parsed = parseHorario(subject.horario);
  return {
    name: subject.name,
    courseId: subject.courseId,
    scheduleSlots: parsed.slots,
  };
}

function filterCourses(courses: AdminCourse[], query: string): AdminCourse[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return courses;
  return courses.filter((course) =>
    [
      course.name,
      course.division,
      courseCycleLabel(course.year, course.specialty),
      `${displayYearForInternalYear(course.year)}°`,
    ]
      .join(" ")
      .toLowerCase()
      .includes(needle)
  );
}

function userLabel(user: AdminUser): string {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
}

function userAssignmentDetail(user: AdminUser): string {
  const dni = user.dni.trim() || "—";
  const email = user.email || "Sin email";
  return `${dni} - ${email} - ${user.roleLabel}`;
}

export default function AdminCursosPage() {
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [courseFormOpen, setCourseFormOpen] = useState(false);
  const [subjectFormOpen, setSubjectFormOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [assignedUsersMenuOpen, setAssignedUsersMenuOpen] = useState(false);
  const [subjectsMenuOpen, setSubjectsMenuOpen] = useState(false);
  const [listMenuError, setListMenuError] = useState<string | null>(null);
  const [editingCourse, setEditingCourse] = useState<AdminCourse | null>(null);
  const [editingSubject, setEditingSubject] = useState<AdminSubject | null>(null);
  const [assignmentCourse, setAssignmentCourse] = useState<AdminCourse | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [courseForm, setCourseForm] = useState<CourseFormState>(EMPTY_COURSE_FORM);
  const [subjectForm, setSubjectForm] = useState<SubjectFormState>(EMPTY_SUBJECT_FORM);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  const visibleCourses = useMemo(() => filterCourses(courses, query), [courses, query]);
  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId]
  );
  const subjectsForSelectedCourse = useMemo(
    () =>
      selectedCourse
        ? subjects.filter((subject) => subject.courseId === selectedCourse.id)
        : [],
    [selectedCourse, subjects]
  );
  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const assignedUsersForCourse = useMemo(() => {
    if (!selectedCourse) return [];
    return selectedCourse.assignedUserIds
      .map((id) => usersById.get(id))
      .filter((user): user is AdminUser => Boolean(user));
  }, [selectedCourse, usersById]);
  const courseDivisionOptions = useMemo(
    () => divisionOptionsForYear(Number(courseForm.year)),
    [courseForm.year]
  );

  const loadData = useCallback(async () => {
    const [coursesData, usersData, subjectsData] = await Promise.all([
      apiFetchWithRetry<AdminCoursesResponse>("/api/admin/cursos"),
      apiFetchWithRetry<AdminUsersResponse>("/api/admin/users"),
      apiFetchWithRetry<AdminSubjectsResponse>("/api/admin/materias"),
    ]);
    setCourses(coursesData.courses);
    setUsers(usersData.users);
    setSubjects(subjectsData.subjects);
    setSelectedCourseId((current) => {
      if (current && coursesData.courses.some((course) => course.id === current)) {
        return current;
      }
      return coursesData.courses[0]?.id ?? null;
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

  function professorNames(subject: AdminSubject): string {
    const names = subject.professorIds
      .map((id) => {
        const user = usersById.get(id);
        return user ? userLabel(user) : null;
      })
      .filter((name): name is string => Boolean(name));
    return names.length > 0 ? names.join(", ") : "Sin profesor asignado";
  }

  function openCreateCourse() {
    setEditingCourse(null);
    setCourseForm(EMPTY_COURSE_FORM);
    setModalError(null);
    setCourseFormOpen(true);
  }

  function openEditCourse(course: AdminCourse) {
    setEditingCourse(course);
    setCourseForm(courseToForm(course));
    setModalError(null);
    setCourseFormOpen(true);
  }

  function closeCourseForm() {
    setCourseFormOpen(false);
    setEditingCourse(null);
    setModalError(null);
  }

  function openCreateSubject() {
    if (!selectedCourse) return;
    setEditingSubject(null);
    setSubjectForm({
      ...EMPTY_SUBJECT_FORM,
      courseId: selectedCourse.id,
    });
    setModalError(null);
    setSubjectFormOpen(true);
  }

  function openEditSubject(subject: AdminSubject) {
    setEditingSubject(subject);
    setSubjectForm(subjectToForm(subject));
    setModalError(null);
    setSubjectFormOpen(true);
  }

  function closeSubjectForm() {
    setSubjectFormOpen(false);
    setEditingSubject(null);
    setModalError(null);
  }

  function openAssignments(course: AdminCourse) {
    setAssignmentCourse(course);
    setSelectedUserIds(new Set(course.assignedUserIds));
    setModalError(null);
    setAssignmentOpen(true);
  }

  function closeAssignments() {
    setAssignmentOpen(false);
    setAssignmentCourse(null);
    setModalError(null);
  }

  function openAssignedUsersMenu() {
    setListMenuError(null);
    setAssignedUsersMenuOpen(true);
  }

  function closeAssignedUsersMenu() {
    setAssignedUsersMenuOpen(false);
    setListMenuError(null);
  }

  function openSubjectsMenu() {
    setListMenuError(null);
    setSubjectsMenuOpen(true);
  }

  function closeSubjectsMenu() {
    setSubjectsMenuOpen(false);
    setListMenuError(null);
  }

  function openAddUsersFromMenu() {
    if (!selectedCourse) return;
    closeAssignedUsersMenu();
    openAssignments(selectedCourse);
  }

  function openAddSubjectFromMenu() {
    closeSubjectsMenu();
    openCreateSubject();
  }

  async function handleRemoveUserFromCourse(user: AdminUser) {
    if (!selectedCourse) return;
    if (!window.confirm(`¿Quitar a ${userLabel(user)} del curso?`)) return;
    setListMenuError(null);
    setSubmitting(true);
    try {
      const nextIds = selectedCourse.assignedUserIds.filter((id) => id !== user.id);
      await apiFetch<{ course: AdminCourse }>(
        `/api/admin/cursos/${selectedCourse.id}/users`,
        {
          method: "PUT",
          body: JSON.stringify({ userIds: nextIds }),
        }
      );
      await loadData();
    } catch (e) {
      setListMenuError(e instanceof ApiError ? e.message : "No se pudo quitar el usuario");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleUser(id: string) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCourseSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setModalError(null);
    const payload = {
      year: Number(courseForm.year),
      division: courseForm.division,
      specialty: courseForm.specialty,
    };
    try {
      let savedCourseId = editingCourse?.id ?? null;
      if (editingCourse) {
        const data = await apiFetch<{ course: AdminCourse }>(
          `/api/admin/cursos/${editingCourse.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          }
        );
        savedCourseId = data.course.id;
      } else {
        const data = await apiFetch<{ course: AdminCourse }>("/api/admin/cursos", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        savedCourseId = data.course.id;
      }
      await loadData();
      if (savedCourseId) setSelectedCourseId(savedCourseId);
      closeCourseForm();
    } catch (e) {
      setModalError(e instanceof ApiError ? e.message : "No se pudo guardar");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubjectSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setModalError(null);
    const payload = {
      name: subjectForm.name,
      courseId: Number(subjectForm.courseId),
      horario: composeHorario(subjectForm.scheduleSlots),
    };
    try {
      if (editingSubject) {
        await apiFetch<{ subject: AdminSubject }>(
          `/api/admin/materias/${editingSubject.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          }
        );
      } else {
        await apiFetch<{ subject: AdminSubject }>("/api/admin/materias", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      await loadData();
      setSelectedCourseId(subjectForm.courseId);
      closeSubjectForm();
    } catch (e) {
      setModalError(e instanceof ApiError ? e.message : "No se pudo guardar");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveAssignments() {
    if (!assignmentCourse) return;
    setSubmitting(true);
    setModalError(null);
    try {
      await apiFetch<{ course: AdminCourse }>(`/api/admin/cursos/${assignmentCourse.id}/users`, {
        method: "PUT",
        body: JSON.stringify({ userIds: [...selectedUserIds] }),
      });
      await loadData();
      setSelectedCourseId(assignmentCourse.id);
      closeAssignments();
    } catch (e) {
      setModalError(e instanceof ApiError ? e.message : "No se pudo asignar");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteCourse(course: AdminCourse) {
    if (!window.confirm(`¿Eliminar el curso ${course.name}?`)) return;
    setError(null);
    try {
      await apiFetch<{ deleted: string }>(`/api/admin/cursos/${course.id}`, {
        method: "DELETE",
      });
      await loadData();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo eliminar");
    }
  }

  async function handleDeleteSubject(subject: AdminSubject) {
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
      <header className="admin-page-header">
        <div>
          <p className="admin-page-header__eyebrow">Administración</p>
          <h1 className="admin-page-header__title">Gestión de Cursos</h1>
          <p className="admin-page-header__subtitle">
            Administrá cursos, asignaciones y materias desde una vista contextual.
          </p>
        </div>
        <button
          type="button"
          className="projects-panel__action-btn projects-panel__action-btn--primary"
          onClick={openCreateCourse}
          disabled={loading}
        >
          Crear Curso
        </button>
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
            <span className="sr-only">Buscar cursos</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por año, división u orientación"
            />
          </label>
        </div>

        {loading ? (
          <div className="projects-table projects-table--empty" role="status">
            Cargando cursos…
          </div>
        ) : visibleCourses.length === 0 ? (
          <div className="projects-table projects-table--empty" role="status">
            No hay cursos para mostrar.
          </div>
        ) : (
          <div className="admin-course-layout">
            <aside className="admin-course-list" aria-label="Lista de cursos">
              <div className="admin-course-list__header">
                <h2>Lista de Cursos</h2>
                <span>{visibleCourses.length}</span>
              </div>
              <div className="admin-course-list__items">
                {visibleCourses.map((course) => {
                  const active = course.id === selectedCourseId;
                  return (
                    <button
                      key={course.id}
                      type="button"
                      className={`admin-course-card${active ? " admin-course-card--active" : ""}`}
                      onClick={() => setSelectedCourseId(course.id)}
                      aria-pressed={active}
                    >
                      <span className="admin-course-card__badge">
                        {displayYearForInternalYear(course.year)}°
                      </span>
                      <strong>{course.name}</strong>
                      <small>{courseCycleLabel(course.year, course.specialty)}</small>
                      <span className="admin-course-card__meta">
                        <BookOpen size={14} aria-hidden />
                        {course.subjectCount} materias
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <article className="admin-course-detail">
              {!selectedCourse ? (
                <div className="admin-empty-detail">
                  <GraduationCap size={42} aria-hidden />
                  <p>Seleccioná un curso para ver el detalle.</p>
                </div>
              ) : (
                <>
                  <div className="admin-course-detail__header">
                    <div className="admin-course-detail__title">
                      <span className="admin-course-detail__icon">
                        <GraduationCap size={24} aria-hidden />
                      </span>
                      <div>
                        <h2>{selectedCourse.name}</h2>
                        <p>
                          División {selectedCourse.division || "—"} —{" "}
                          {courseCycleLabel(selectedCourse.year, selectedCourse.specialty)}
                        </p>
                      </div>
                    </div>
                    <div className="admin-course-detail__actions">
                      <button
                        type="button"
                        className="projects-panel__action-btn"
                        onClick={() => openEditCourse(selectedCourse)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="projects-panel__action-btn"
                        onClick={() => openAssignments(selectedCourse)}
                      >
                        Asignar Usuarios
                      </button>
                      <button
                        type="button"
                        className="projects-panel__action-btn projects-panel__action-btn--primary"
                        onClick={openCreateSubject}
                      >
                        Agregar Materia
                      </button>
                    </div>
                  </div>

                  <div className="admin-course-metrics" aria-label="Resumen del curso">
                    <div className="admin-course-metrics__card">
                      <div>
                        <span>Usuarios asignados</span>
                        <strong>{selectedCourse.assignedUserIds.length}</strong>
                      </div>
                      <button
                        type="button"
                        className="admin-course-metrics__open"
                        onClick={openAssignedUsersMenu}
                        aria-label="Ver usuarios asignados"
                      >
                        <SquareArrowOutUpRight size={18} aria-hidden />
                      </button>
                    </div>
                    <div className="admin-course-metrics__card">
                      <div>
                        <span>Materias</span>
                        <strong>{subjectsForSelectedCourse.length}</strong>
                      </div>
                      <button
                        type="button"
                        className="admin-course-metrics__open"
                        onClick={openSubjectsMenu}
                        aria-label="Ver materias del curso"
                      >
                        <SquareArrowOutUpRight size={18} aria-hidden />
                      </button>
                    </div>
                  </div>

                  <div className="admin-course-subjects">
                    <div className="admin-course-subjects__header">
                      <h3>Materias del curso</h3>
                      <BookOpen size={20} aria-hidden />
                    </div>
                    {subjectsForSelectedCourse.length === 0 ? (
                      <div className="admin-empty-detail admin-empty-detail--compact">
                        <BookOpen size={28} aria-hidden />
                        <p>No hay materias asignadas a este curso.</p>
                      </div>
                    ) : (
                      <div className="projects-table-wrapper">
                        <table className="projects-table admin-table">
                          <thead>
                            <tr>
                              <th scope="col">Materia</th>
                              <th scope="col">Profesor</th>
                              <th scope="col">Horario</th>
                              <th scope="col">Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {subjectsForSelectedCourse.map((subject) => (
                              <tr key={subject.id}>
                                <td
                                  className="projects-table__cell projects-table__cell--name"
                                  data-label="Materia"
                                >
                                  {subject.name}
                                </td>
                                <td
                                  className="projects-table__cell projects-table__cell--muted"
                                  data-label="Profesor"
                                >
                                  {professorNames(subject)}
                                </td>
                                <td
                                  className="projects-table__cell projects-table__cell--muted"
                                  data-label="Horario"
                                >
                                  {subject.horario || "—"}
                                </td>
                                <td
                                  className="projects-table__cell projects-table__cell--actions"
                                  data-label="Acciones"
                                >
                                  <button
                                    type="button"
                                    className="projects-table__action"
                                    onClick={() => openEditSubject(subject)}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    className="projects-table__action admin-table__danger"
                                    onClick={() => handleDeleteSubject(subject)}
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
                  </div>

                  <div className="admin-course-detail__footer">
                    <button
                      type="button"
                      className="projects-panel__action-btn admin-table__danger"
                      onClick={() => handleDeleteCourse(selectedCourse)}
                    >
                      Eliminar Curso
                    </button>
                  </div>
                </>
              )}
            </article>
          </div>
        )}
      </section>

      <AdminModal
        open={courseFormOpen}
        title={editingCourse ? "Editar curso" : "Crear curso"}
        error={modalError}
        onClose={closeCourseForm}
        footer={
          <>
            <button
              type="button"
              className="project-modal__btn project-modal__btn--muted"
              onClick={closeCourseForm}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="admin-course-form"
              className="project-modal__btn project-modal__btn--primary"
              disabled={submitting}
            >
              {submitting ? "Guardando…" : "Guardar"}
            </button>
          </>
        }
      >
        <form id="admin-course-form" className="admin-form" onSubmit={handleCourseSubmit}>
          <div className="admin-form__row">
            <label className="project-modal__label">
              Año
              <select
                className="project-modal__input"
                value={courseForm.year}
                onChange={(e) => {
                  const year = e.target.value;
                  const yearNumber = Number(year);
                  setCourseForm((prev) => ({
                    year,
                    division: normalizeDivisionForYear(prev.division, yearNumber),
                    specialty: isSuperiorYear(yearNumber)
                      ? prev.specialty || SUPERIOR_ORIENTATION_OPTIONS[0]
                      : "",
                  }));
                }}
                required
              >
                {YEAR_OPTIONS.map((year) => (
                  <option key={year} value={year}>
                    {yearSelectLabel(year)}
                  </option>
                ))}
              </select>
            </label>
            <label className="project-modal__label">
              División
              <select
                className="project-modal__input"
                value={courseForm.division}
                onChange={(e) => setCourseForm({ ...courseForm, division: e.target.value })}
                required
              >
                {courseDivisionOptions.map((division) => (
                  <option key={division} value={division}>
                    {division}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {isSuperiorYear(Number(courseForm.year)) ? (
            <label className="project-modal__label">
              Orientación
              <select
                className="project-modal__input"
                value={courseForm.specialty}
                onChange={(e) => setCourseForm({ ...courseForm, specialty: e.target.value })}
                required
              >
                {SUPERIOR_ORIENTATION_OPTIONS.map((specialty) => (
                  <option key={specialty} value={specialty}>
                    {specialty}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <p className="admin-form__hint">
            Vista previa:{" "}
            <strong>
              {composeCoursePreview(
                Number(courseForm.year),
                courseForm.division,
                courseForm.specialty
              )}
            </strong>
          </p>
        </form>
      </AdminModal>

      <AdminModal
        open={subjectFormOpen}
        title={editingSubject ? "Editar materia" : "Agregar materia"}
        error={modalError}
        onClose={closeSubjectForm}
        footer={
          <>
            <button
              type="button"
              className="project-modal__btn project-modal__btn--muted"
              onClick={closeSubjectForm}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="admin-course-subject-form"
              className="project-modal__btn project-modal__btn--primary"
              disabled={submitting}
            >
              {submitting ? "Guardando…" : "Guardar"}
            </button>
          </>
        }
      >
        <form
          id="admin-course-subject-form"
          className="admin-form"
          onSubmit={handleSubjectSubmit}
        >
          <label className="project-modal__label">
            Nombre de la materia
            <input
              type="text"
              className="project-modal__input"
              value={subjectForm.name}
              onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
              required
            />
          </label>
          <label className="project-modal__label">
            Curso
            <select
              className="project-modal__input"
              value={subjectForm.courseId}
              onChange={(e) => setSubjectForm({ ...subjectForm, courseId: e.target.value })}
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
            slots={subjectForm.scheduleSlots}
            onSlotsChange={(scheduleSlots) =>
              setSubjectForm({ ...subjectForm, scheduleSlots })
            }
          />
        </form>
      </AdminModal>

      <AdminModal
        open={assignmentOpen}
        title={`Asignar usuarios${assignmentCourse ? ` a ${assignmentCourse.name}` : ""}`}
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
          title="Usuarios del curso"
          searchable
          requireSearchQuery
          searchPlaceholder="DNI, correo o nombre del usuario"
          resetKey={assignmentCourse?.id}
          options={users.map((item) => ({
            id: item.id,
            label: userLabel(item),
            detail: userAssignmentDetail(item),
            searchText: [item.firstName, item.lastName, item.email, item.dni].join(" "),
          }))}
          selectedIds={selectedUserIds}
          emptyText="No hay usuarios disponibles."
          onToggle={toggleUser}
        />
      </AdminModal>

      <AdminModal
        open={assignedUsersMenuOpen}
        title="Usuarios asignados"
        error={listMenuError}
        onClose={closeAssignedUsersMenu}
        footer={
          <>
            <button
              type="button"
              className="project-modal__btn project-modal__btn--muted"
              onClick={closeAssignedUsersMenu}
            >
              Cerrar
            </button>
            <button
              type="button"
              className="project-modal__btn project-modal__btn--primary"
              onClick={openAddUsersFromMenu}
              disabled={submitting}
            >
              Añadir
            </button>
          </>
        }
      >
        {assignedUsersForCourse.length === 0 ? (
          <p className="admin-course-menu__empty">No hay usuarios asignados a este curso.</p>
        ) : (
          <ul className="admin-course-menu__list">
            {assignedUsersForCourse.map((user) => (
              <li key={user.id} className="admin-course-menu__item">
                <div className="admin-course-menu__info">
                  <strong>{userLabel(user)}</strong>
                  <small>{userAssignmentDetail(user)}</small>
                </div>
                <button
                  type="button"
                  className="projects-table__action admin-table__danger"
                  onClick={() => handleRemoveUserFromCourse(user)}
                  disabled={submitting}
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}
      </AdminModal>

      <AdminModal
        open={subjectsMenuOpen}
        title="Materias del curso"
        error={listMenuError}
        onClose={closeSubjectsMenu}
        footer={
          <>
            <button
              type="button"
              className="project-modal__btn project-modal__btn--muted"
              onClick={closeSubjectsMenu}
            >
              Cerrar
            </button>
            <button
              type="button"
              className="project-modal__btn project-modal__btn--primary"
              onClick={openAddSubjectFromMenu}
              disabled={submitting}
            >
              Añadir
            </button>
          </>
        }
      >
        {subjectsForSelectedCourse.length === 0 ? (
          <p className="admin-course-menu__empty">No hay materias en este curso.</p>
        ) : (
          <ul className="admin-course-menu__list">
            {subjectsForSelectedCourse.map((subject) => (
              <li key={subject.id} className="admin-course-menu__item">
                <div className="admin-course-menu__info">
                  <strong>{subject.name}</strong>
                  <small>
                    {subject.horario || "Sin horario"} — {professorNames(subject)}
                  </small>
                </div>
                <button
                  type="button"
                  className="projects-table__action admin-table__danger"
                  onClick={() => handleDeleteSubject(subject)}
                  disabled={submitting}
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}
      </AdminModal>
    </DashboardLayout>
  );
}
