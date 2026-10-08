import { useCallback, useEffect, useState, type FormEvent } from "react";
import { BadgeCheck, Pencil, Plus, Trash2, User } from "lucide-react";
import { AdminModal } from "../admin/AdminModal";
import { ApiError, apiFetch, apiFetchWithRetry, isUnauthorizedError } from "../../lib/api";
import type { ProjectGradeEntry, ProjectGradeMember } from "../../types/projects";

interface ProjectGradesPanelProps {
  projectId: string;
  /** Refresca el detalle del proyecto (p. ej. promedio global) cuando cambie una nota. */
  onChanged?: () => void;
}

function memberName(member: ProjectGradeMember): string {
  const full = [member.lastName, member.firstName].filter(Boolean).join(", ");
  return full || member.email || (member.dni ? `DNI ${member.dni}` : "Integrante");
}

function memberInitials(member: ProjectGradeMember): string {
  const initials = `${member.lastName.charAt(0)}${member.firstName.charAt(0)}`.trim();
  return initials ? initials.toUpperCase() : "?";
}

function formatDate(value: string): string {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface NoteFormState {
  nota: string;
  descripcion: string;
  fecha: string;
}

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function ProjectGradesPanel({ projectId, onChanged }: ProjectGradesPanelProps) {
  const [members, setMembers] = useState<ProjectGradeMember[]>([]);
  const [canGrade, setCanGrade] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    member: ProjectGradeMember;
    entry: ProjectGradeEntry | null;
  } | null>(null);
  const [form, setForm] = useState<NoteFormState>({
    nota: "",
    descripcion: "",
    fecha: todayIso(),
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const data = await apiFetchWithRetry<{ canGrade: boolean; members: ProjectGradeMember[] }>(
      `/api/projects/${projectId}/calificaciones`
    );
    setMembers(data.members);
    setCanGrade(data.canGrade);
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    load()
      .catch((e) => {
        if (!cancelled && !isUnauthorizedError(e)) {
          setError(e instanceof Error ? e.message : "No se pudieron cargar las notas");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  function openCreate(member: ProjectGradeMember) {
    setEditing({ member, entry: null });
    setForm({ nota: "", descripcion: "", fecha: todayIso() });
    setError(null);
  }

  function openEdit(member: ProjectGradeMember, entry: ProjectGradeEntry) {
    setEditing({ member, entry });
    setForm({
      nota: entry.nota === null ? "" : String(entry.nota),
      descripcion: entry.descripcion,
      fecha: entry.fecha,
    });
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const nota = Number(form.nota);
    if (!Number.isFinite(nota) || nota < 0 || nota > 10) {
      setError("La nota debe estar entre 0 y 10");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = JSON.stringify({
        userId: editing.member.userId,
        nota,
        descripcion: form.descripcion.trim(),
        fecha: form.fecha,
      });
      const result = editing.entry
        ? await apiFetch<{ members: ProjectGradeMember[] }>(
            `/api/projects/${projectId}/calificaciones/${editing.entry.id}`,
            { method: "PATCH", body: JSON.stringify({ nota, descripcion: form.descripcion.trim(), fecha: form.fecha }) }
          )
        : await apiFetch<{ members: ProjectGradeMember[] }>(
            `/api/projects/${projectId}/calificaciones`,
            { method: "POST", body }
          );
      setMembers(result.members);
      setEditing(null);
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la nota");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(entry: ProjectGradeEntry) {
    if (!window.confirm("¿Eliminar esta nota?")) return;
    setError(null);
    try {
      const result = await apiFetch<{ members: ProjectGradeMember[] }>(
        `/api/projects/${projectId}/calificaciones/${entry.id}`,
        { method: "DELETE" }
      );
      setMembers(result.members);
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo eliminar la nota");
    }
  }

  if (loading) {
    return <p className="project-config__member-meta">Cargando notas…</p>;
  }

  return (
    <div className="project-grades">
      {error && !editing ? (
        <p className="dashboard-error" role="alert">
          {error}
        </p>
      ) : null}
      {!canGrade ? (
        <p className="project-config__member-meta">
          Solo un profesor asignado o administrador puede cargar notas. Podés ver tu promedio.
        </p>
      ) : null}

      {members.length === 0 ? (
        <p className="project-config__member-meta">Todavía no hay integrantes en el equipo.</p>
      ) : (
        <ul className="project-grades__list">
          {members.map((member) => (
            <li key={member.userId} className="project-grades__member">
              <div className="project-grades__member-head">
                <div className="project-grades__identity">
                  {member.profilePhotoUrl ? (
                    <img src={member.profilePhotoUrl} alt="" className="project-grades__avatar" />
                  ) : (
                    <span className="project-grades__avatar project-grades__avatar--fallback">
                      {memberInitials(member)}
                    </span>
                  )}
                  <div>
                    <p className="project-grades__name">{memberName(member)}</p>
                    <span className="project-grades__average">
                      <BadgeCheck size={14} aria-hidden />
                      Promedio: {member.average ?? "—"}
                    </span>
                  </div>
                </div>
                {canGrade ? (
                  <button
                    type="button"
                    className="projects-table__action"
                    onClick={() => openCreate(member)}
                  >
                    <Plus size={14} aria-hidden /> Agregar nota
                  </button>
                ) : null}
              </div>

              {member.grades.length === 0 ? (
                <p className="project-grades__empty">Sin notas cargadas.</p>
              ) : (
                <ul className="project-grades__notes">
                  {member.grades.map((entry) => (
                    <li key={entry.id} className="project-grades__note">
                      <span className="project-grades__note-date">{formatDate(entry.fecha)}</span>
                      <span className="project-grades__note-value">{entry.nota ?? "—"}</span>
                      <span className="project-grades__note-desc">
                        {entry.descripcion || "Sin descripción"}
                      </span>
                      {canGrade ? (
                        <span className="project-grades__note-actions">
                          <button
                            type="button"
                            className="project-grades__icon-btn"
                            onClick={() => openEdit(member, entry)}
                            aria-label={`Editar nota del ${formatDate(entry.fecha)}`}
                          >
                            <Pencil size={15} aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="project-grades__icon-btn project-grades__icon-btn--danger"
                            onClick={() => void handleDelete(entry)}
                            aria-label={`Eliminar nota del ${formatDate(entry.fecha)}`}
                          >
                            <Trash2 size={15} aria-hidden />
                          </button>
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <AdminModal
        open={editing !== null}
        title={editing?.entry ? "Editar nota" : "Nueva nota"}
        error={error}
        onClose={() => setEditing(null)}
        footer={
          <>
            <button
              type="button"
              className="project-modal__btn project-modal__btn--muted"
              onClick={() => setEditing(null)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="grade-note-form"
              className="project-modal__btn project-modal__btn--primary"
              disabled={saving}
            >
              {saving ? "Guardando…" : "Guardar nota"}
            </button>
          </>
        }
      >
        {editing ? (
          <form id="grade-note-form" className="admin-form" onSubmit={handleSubmit}>
            <p className="project-config__member-meta">
              <User size={14} aria-hidden /> {memberName(editing.member)}
            </p>
            <div className="admin-form__row">
              <label className="project-modal__label">
                Nota (0–10)
                <input
                  type="number"
                  className="project-modal__input"
                  min={0}
                  max={10}
                  step="0.01"
                  value={form.nota}
                  onChange={(e) => setForm({ ...form, nota: e.target.value })}
                  required
                />
              </label>
              <label className="project-modal__label">
                Fecha
                <input
                  type="date"
                  className="project-modal__input"
                  value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                  required
                />
              </label>
            </div>
            <label className="project-modal__label">
              Descripción
              <textarea
                className="project-modal__input"
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                rows={3}
                maxLength={500}
                placeholder="Ej.: participación en clase, entrega del TP…"
              />
            </label>
          </form>
        ) : null}
      </AdminModal>
    </div>
  );
}
