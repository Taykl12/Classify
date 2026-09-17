import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { ArrowLeft, ExternalLink, Lock, Plus, Trash2, User } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { EmailChipInput } from "../components/projects/EmailChipInput";
import { useAuth } from "../contexts/AuthContext";
import { ApiError, apiFetch, apiFetchWithRetry, isUnauthorizedError } from "../lib/api";
import { ensureCreatorInMembers, sortMembersWithCreatorFirst } from "../lib/memberEmails";
import { documentNameFromUrl, openExternalUrl } from "../lib/openUrl";
import type {
  ProjectConfigTab,
  ProjectDetail,
  ProjectDocument,
  ProjectGradeMember,
  ProjectGradesResponse,
  ProjectLocks,
} from "../types/projects";
import { ROUTES } from "../routes";
import "../styles/dashboard.css";
import "../styles/project-config.css";

interface ConfigFormState {
  name: string;
  status: "Abierto" | "Cerrado";
  scopeNotes: string;
  objective: string;
  scopeDetail: string;
  preprojectValidated: boolean;
  backupLink: string;
  gradesLink: string;
  documents: ProjectDocument[];
  memberEmails: string[];
}

const DEFAULT_LOCKS: ProjectLocks = {
  scope: false,
  documentation: false,
  team: false,
};

function detailToForm(detail: ProjectDetail, creatorEmail?: string | null): ConfigFormState {
  return {
    name: detail.name,
    status: detail.status,
    scopeNotes: detail.scopeNotes ?? "",
    objective: detail.objective ?? detail.description ?? "",
    scopeDetail: detail.scopeDetail ?? "",
    preprojectValidated: Boolean(detail.preprojectValidated),
    backupLink: detail.backupLink ?? "",
    gradesLink: detail.gradesLink ?? "",
    documents: detail.documents ?? [],
    memberEmails: ensureCreatorInMembers(detail.memberEmails ?? [], creatorEmail ?? detail.ownerEmail),
  };
}

function gradeMemberName(member: ProjectGradeMember): string {
  const full = [member.lastName, member.firstName].filter(Boolean).join(", ");
  if (full) return full;
  if (member.email) return member.email;
  if (member.dni) return `DNI ${member.dni}`;
  return "Integrante";
}

function gradeMemberInitials(member: ProjectGradeMember): string {
  const initials = `${member.lastName.charAt(0)}${member.firstName.charAt(0)}`.trim();
  return initials ? initials.toUpperCase() : "?";
}

function clampGrade(raw: string): number | null {
  if (!raw.trim()) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(10, Math.max(0, parsed));
}

function LinkField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="project-config__field">
      <span className="project-config__label">{label}</span>
      <div className="project-config__link-row">
        <input
          type="url"
          className="project-config__input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
          disabled={disabled}
        />
        <button
          type="button"
          className="project-config__open-btn"
          disabled={!value.trim()}
          onClick={() => openExternalUrl(value)}
        >
          Abrir
        </button>
      </div>
    </div>
  );
}

function LockNotice({ locked }: { locked: boolean }) {
  if (!locked) return null;
  return (
    <p className="project-config__member-meta" role="status">
      Esta sección fue cerrada por el profesor.
    </p>
  );
}

export default function ProjectConfigPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<ProjectConfigTab>("alcance");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [canManageProject, setCanManageProject] = useState(false);
  const [canManageLocks, setCanManageLocks] = useState(false);
  const [locks, setLocks] = useState<ProjectLocks>(DEFAULT_LOCKS);
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
  const [form, setForm] = useState<ConfigFormState | null>(null);
  const [saved, setSaved] = useState<ConfigFormState | null>(null);
  const [docNameDraft, setDocNameDraft] = useState("");
  const [docDraft, setDocDraft] = useState("");
  const [grades, setGrades] = useState<ProjectGradeMember[]>([]);
  const [savedGrades, setSavedGrades] = useState<ProjectGradeMember[]>([]);
  const [canGrade, setCanGrade] = useState(false);
  const [gradesError, setGradesError] = useState<string | null>(null);

  const creatorEmail = user?.email ?? ownerEmail;

  const load = useCallback(async () => {
    if (!projectId) return;
    setError(null);
    const [detail, gradesResult] = await Promise.all([
      apiFetchWithRetry<ProjectDetail>(`/api/projects/${projectId}`),
      apiFetchWithRetry<ProjectGradesResponse>(`/api/projects/${projectId}/calificaciones`)
        .then((res) => ({ ok: true as const, res }))
        .catch((e: unknown) => ({ ok: false as const, e })),
    ]);
    const next = detailToForm(detail, user?.email ?? detail.ownerEmail);
    setForm(next);
    setSaved(next);
    setIsOwner(Boolean(detail.isOwner));
    setCanManageProject(Boolean(detail.canManageProject));
    setCanManageLocks(Boolean(detail.canManageLocks));
    setLocks(detail.locks ?? DEFAULT_LOCKS);
    setOwnerEmail(detail.ownerEmail ?? null);

    if (gradesResult.ok) {
      const members = gradesResult.res.members.map((member) => ({ ...member }));
      setGrades(members);
      setSavedGrades(members);
      setCanGrade(Boolean(gradesResult.res.canGrade));
      setGradesError(null);
    } else {
      setGrades([]);
      setSavedGrades([]);
      setCanGrade(false);
      setGradesError(
        gradesResult.e instanceof Error
          ? gradesResult.e.message
          : "No se pudieron cargar las calificaciones"
      );
    }
  }, [projectId, user?.email]);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!cancelled && !isUnauthorizedError(e)) {
          setError(e instanceof Error ? e.message : "Error al cargar");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, load]);

  const sortedMembers = useMemo(() => {
    if (!form) return [];
    return sortMembersWithCreatorFirst(form.memberEmails, ownerEmail ?? creatorEmail);
  }, [form, ownerEmail, creatorEmail]);

  const scopeEditable = canManageLocks || (isOwner && !locks.scope);
  const documentationEditable = canManageLocks || (isOwner && !locks.documentation);
  const teamEditable = canManageLocks || (isOwner && !locks.team);
  const canApprove = canManageLocks;
  const canSave = canManageProject;

  function patchForm(patch: Partial<ConfigFormState>) {
    setForm((f) => (f ? { ...f, ...patch } : f));
  }

  function handleUndo() {
    if (saved) setForm({ ...saved });
    setGrades(savedGrades.map((member) => ({ ...member })));
  }

  function toggleLock(key: keyof ProjectLocks) {
    setLocks((current) => ({ ...current, [key]: !current[key] }));
  }

  async function handleSave() {
    if (!projectId || !form || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      if (canManageLocks) {
        Object.assign(payload, {
          name: form.name,
          status: form.status,
          objective: form.objective,
          scopeDetail: form.scopeDetail,
          scopeNotes: form.scopeNotes,
          preprojectValidated: form.preprojectValidated,
          backupLink: form.backupLink,
          documents: form.documents,
          memberEmails: ensureCreatorInMembers(form.memberEmails, creatorEmail),
          locks,
        });
      } else if (isOwner) {
        if (scopeEditable) {
          Object.assign(payload, {
            name: form.name,
            status: form.status,
            objective: form.objective,
            scopeDetail: form.scopeDetail,
            scopeNotes: form.scopeNotes,
          });
        }
        if (documentationEditable) {
          Object.assign(payload, {
            backupLink: form.backupLink,
            documents: form.documents,
          });
        }
        if (teamEditable) {
          payload.memberEmails = ensureCreatorInMembers(form.memberEmails, creatorEmail);
        }
      }

      await apiFetch<ProjectDetail>(`/api/projects/${projectId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      if (canGrade && grades.length > 0) {
        await apiFetch<ProjectGradesResponse>(`/api/projects/${projectId}/calificaciones`, {
          method: "PUT",
          body: JSON.stringify({
            grades: grades.map((member) => ({ userId: member.userId, grade: member.grade })),
          }),
        });
      }
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  function addDocument() {
    const url = docDraft.trim();
    if (!url || !form) return;
    const name = docNameDraft.trim() || documentNameFromUrl(url);
    patchForm({
      documents: [...form.documents, { name, url }],
    });
    setDocNameDraft("");
    setDocDraft("");
  }

  function removeDocument(index: number) {
    if (!form) return;
    patchForm({
      documents: form.documents.filter((_, i) => i !== index),
    });
  }

  function updateDocument(
    index: number,
    patch: Partial<Pick<ProjectDocument, "name" | "url">>
  ) {
    if (!form) return;
    patchForm({
      documents: form.documents.map((doc, i) =>
        i === index ? { ...doc, ...patch } : doc
      ),
    });
  }

  function handleDocKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addDocument();
    }
  }

  if (loading || !form) {
    return (
      <>
        <p className="dashboard-loading">{loading ? "Cargando configuración…" : "Proyecto no encontrado"}</p>
      </>
    );
  }

  return (
    <>
      <header className="project-config__hero">
        <div className="project-config__hero-left">
          <button
            type="button"
            className="project-config__back"
            onClick={() => navigate(ROUTES.PROJECTS)}
            aria-label="Volver a proyectos"
          >
            <ArrowLeft size={22} aria-hidden />
          </button>
          <div>
            <h1 className="project-config__title">Configuracion del Proyecto</h1>
            <p className="project-config__subtitle">Gestion de Datos Generales y Alcance</p>
          </div>
        </div>
        <div className="project-config__actions">
          <button
            type="button"
            className="project-config__action-btn"
            onClick={handleUndo}
            disabled={!canSave || saving}
          >
            Deshacer Cambios
          </button>
          <button
            type="button"
            className="project-config__action-btn"
            onClick={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? "Guardando…" : "Guardar Cambios"}
          </button>
        </div>
      </header>

      {error ? (
        <p className="dashboard-error" role="alert">
          {error}
        </p>
      ) : null}

      {canManageLocks ? (
        <section className="dashboard-panel project-config__locks" aria-label="Bloqueos por sección">
          <h2 className="project-config__card-title">
            <Lock size={18} aria-hidden /> Control de secciones
          </h2>
          {(
            [
              ["scope", "Alcance / Objetivo"],
              ["documentation", "Documentación"],
              ["team", "Equipo"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="project-config__checkbox-row">
              <input
                type="checkbox"
                checked={locks[key]}
                onChange={() => toggleLock(key)}
              />
              {label} {locks[key] ? "cerrada para alumnos" : "abierta"}
            </label>
          ))}
        </section>
      ) : null}

      <div className="project-config__layout">
        <aside className="project-config__milestones" aria-label="Hitos y estado">
          <div className="project-config__card">
            <h2 className="project-config__card-title">Hitos y Estado</h2>
            <p className="project-config__label">Estado Actual</p>
            <LockNotice locked={!scopeEditable && isOwner} />
            <div className="project-config__status">
              <span
                className={`project-config__status-dot project-config__status-dot--${
                  form.status === "Abierto" ? "open" : "closed"
                }`}
                aria-hidden
              />
              {/* Control segmentado en vez de <select>: el estado es binario y el
                  desplegable nativo no se puede estilizar. */}
              <div
                className="project-config__status-pill"
                role="group"
                aria-label="Estado del proyecto"
              >
                {(["Abierto", "Cerrado"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`project-config__status-option${
                      form.status === option
                        ? " project-config__status-option--active"
                        : ""
                    }`}
                    onClick={() => patchForm({ status: option })}
                    disabled={!scopeEditable}
                    aria-pressed={form.status === option}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="project-config__card">
            <h2 className="project-config__card-title">Notas del Proyecto</h2>
            <LockNotice locked={!scopeEditable && isOwner} />
            <textarea
              className="project-config__textarea"
              value={form.scopeNotes}
              onChange={(e) => patchForm({ scopeNotes: e.target.value })}
              placeholder="Notas de Alcance:"
              disabled={!scopeEditable}
            />
          </div>
        </aside>

        <section className="project-config__main" aria-label="Pestañas de configuración">
          <nav className="project-config__tabs" aria-label="Secciones">
            {(
              [
                ["alcance", "Alcance"],
                ["equipo", "Equipo"],
                ["calificaciones", "Calificaciones"],
                ["documentaciones", "Documentaciones"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`project-config__tab${tab === id ? " project-config__tab--active" : ""}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>

          {tab === "alcance" ? (
            <div className="project-config__panel">
              <LockNotice locked={!scopeEditable && isOwner} />
              <label className="project-config__field">
                <span className="project-config__label">Titulo del Proyecto</span>
                <input
                  type="text"
                  className="project-config__input"
                  value={form.name}
                  onChange={(e) => patchForm({ name: e.target.value })}
                  disabled={!scopeEditable}
                />
              </label>
              <label className="project-config__field">
                <span className="project-config__label">Objetivo General</span>
                <textarea
                  className="project-config__input project-config__input--area"
                  value={form.objective}
                  onChange={(e) => patchForm({ objective: e.target.value })}
                  disabled={!scopeEditable}
                />
              </label>
              <label className="project-config__field">
                <span className="project-config__label">Alcance del Proyecto</span>
                <textarea
                  className="project-config__input project-config__input--area"
                  value={form.scopeDetail}
                  onChange={(e) => patchForm({ scopeDetail: e.target.value })}
                  disabled={!scopeEditable}
                />
              </label>
            </div>
          ) : null}

          {tab === "equipo" ? (
            <div className="project-config__panel">
              <LockNotice locked={!teamEditable && isOwner} />
              <div className="project-config__team-grid">
                {sortedMembers.map((email) => (
                  <article key={email} className="project-config__member-card">
                    <div className="project-config__member-avatar" aria-hidden>
                      <User size={28} />
                    </div>
                    <p className="project-config__member-name">{email}</p>
                    <p className="project-config__member-meta">Integrante</p>
                  </article>
                ))}
              </div>
              {teamEditable ? (
                <>
                  <div className="project-config__field project-config__field--spaced">
                    <span className="project-config__label">Agregar integrantes</span>
                    <EmailChipInput
                      emails={form.memberEmails}
                      onChange={(memberEmails) =>
                        patchForm({
                          memberEmails: ensureCreatorInMembers(memberEmails, creatorEmail),
                        })
                      }
                      placeholder="DNI, correo o nombre del usuario"
                    />
                  </div>
                  <p className="project-config__member-meta">
                    Tu correo aparece primero en la lista. Guardá los cambios para aplicar el equipo.
                  </p>
                </>
              ) : null}
            </div>
          ) : null}

          {tab === "calificaciones" ? (
            <div className="project-config__panel">
              <div className="project-config__field">
                <span className="project-config__label">Aprobacion del Anteproyecto</span>
                <label className="project-config__checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.preprojectValidated}
                    onChange={(e) => patchForm({ preprojectValidated: e.target.checked })}
                    disabled={!canApprove}
                  />
                  Proyecto Validado/Viable
                </label>
                {!canApprove ? (
                  <p className="project-config__member-meta">
                    Solo un profesor asignado o administrador puede aprobar el anteproyecto.
                  </p>
                ) : null}
              </div>
              <LockNotice locked={!documentationEditable && isOwner} />
              <LinkField
                label="Documentacion de Respaldo"
                value={form.backupLink}
                onChange={(backupLink) => patchForm({ backupLink })}
                disabled={!documentationEditable}
              />
              <div className="project-config__field">
                <span className="project-config__label">Notas por Integrante</span>
                {gradesError ? (
                  <p className="dashboard-error" role="alert">
                    No se pudieron cargar las calificaciones: {gradesError}
                  </p>
                ) : null}
                {!canGrade ? (
                  <p className="project-config__member-meta">
                    Solo un profesor asignado o administrador puede cargar notas.
                  </p>
                ) : null}
                {grades.length === 0 ? (
                  <p className="project-config__member-meta">
                    Todavía no hay integrantes en el equipo.
                  </p>
                ) : (
                  <table className="project-config__grades-table">
                    <thead>
                      <tr>
                        <th scope="col">Integrante</th>
                        <th scope="col">DNI</th>
                        <th scope="col">Nota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grades.map((member, index) => (
                        <tr key={member.userId}>
                          <td
                            className="project-config__grades-cell"
                            data-label="Integrante"
                          >
                            <div className="project-config__grades-student">
                              {member.profilePhotoUrl ? (
                                <img
                                  src={member.profilePhotoUrl}
                                  alt=""
                                  className="project-config__grades-avatar"
                                />
                              ) : (
                                <span className="project-config__grades-avatar project-config__grades-avatar--fallback">
                                  {gradeMemberInitials(member)}
                                </span>
                              )}
                              <span className="project-config__grades-name">
                                {gradeMemberName(member)}
                              </span>
                            </div>
                          </td>
                          <td
                            className="project-config__grades-cell project-config__grades-cell--muted"
                            data-label="DNI"
                          >
                            {member.dni || "—"}
                          </td>
                          <td className="project-config__grades-cell" data-label="Nota">
                            <input
                              type="number"
                              className="project-config__grade-input"
                              step="0.01"
                              min={0}
                              max={10}
                              inputMode="decimal"
                              value={member.grade ?? ""}
                              disabled={!canGrade}
                              aria-label={`Nota de ${gradeMemberName(member)}`}
                              onChange={(e) => {
                                const grade = clampGrade(e.target.value);
                                setGrades((current) =>
                                  current.map((item, i) =>
                                    i === index ? { ...item, grade } : item
                                  )
                                );
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : null}

          {tab === "documentaciones" ? (
            <div className="project-config__panel">
              <LockNotice locked={!documentationEditable && isOwner} />
              <div className="project-config__field">
                <span className="project-config__label">Agregar Documento:</span>
                <div className="project-config__add-doc-row">
                  <input
                    type="text"
                    className="project-config__doc-name-input"
                    value={docNameDraft}
                    onChange={(e) => setDocNameDraft(e.target.value)}
                    placeholder="Nombre"
                    disabled={!documentationEditable}
                    aria-label="Nombre del documento"
                  />
                  <input
                    type="url"
                    className="project-config__doc-url-input"
                    value={docDraft}
                    onChange={(e) => setDocDraft(e.target.value)}
                    onKeyDown={handleDocKeyDown}
                    placeholder="Ingrese el link del documento"
                    disabled={!documentationEditable}
                    aria-label="Link del documento"
                  />
                  <button
                    type="button"
                    className="project-config__add-btn"
                    onClick={addDocument}
                    disabled={!documentationEditable || !docDraft.trim()}
                    aria-label="Agregar documento"
                  >
                    <Plus size={22} strokeWidth={2.5} aria-hidden />
                  </button>
                </div>
              </div>
              <ul className="project-config__doc-list">
                {form.documents.map((doc, index) => (
                  <li key={`${doc.url}-${index}`} className="project-config__doc-item">
                    <input
                      type="text"
                      className="project-config__doc-name-input"
                      value={doc.name}
                      onChange={(e) => updateDocument(index, { name: e.target.value })}
                      disabled={!documentationEditable}
                      aria-label={`Nombre del documento ${doc.url}`}
                    />
                    <input
                      type="url"
                      className="project-config__doc-url-input"
                      value={doc.url}
                      onChange={(e) => updateDocument(index, { url: e.target.value })}
                      disabled={!documentationEditable}
                      aria-label={`Link del documento ${doc.name}`}
                    />
                    <button
                      type="button"
                      className="project-config__doc-open-btn"
                      onClick={() => openExternalUrl(doc.url)}
                      aria-label={`Abrir ${doc.name}`}
                    >
                      <ExternalLink size={18} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="project-config__remove-btn"
                      onClick={() => removeDocument(index)}
                      disabled={!documentationEditable}
                      aria-label={`Eliminar ${doc.name}`}
                    >
                      <Trash2 size={18} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
              {form.documents.length === 0 ? (
                <p className="project-config__member-meta">Todavía no hay documentos cargados.</p>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}
