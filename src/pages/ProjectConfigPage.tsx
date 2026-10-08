import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { ArrowLeft, BadgeCheck, Circle, ExternalLink, Lock, Plus, Trash2, Unlock, User } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { EmailChipInput } from "../components/projects/EmailChipInput";
import { ProjectGradesPanel } from "../components/projects/ProjectGradesPanel";
import { useAuth } from "../contexts/AuthContext";
import { ApiError, apiFetch, apiFetchWithRetry, isUnauthorizedError } from "../lib/api";
import { ensureCreatorInMembers, sortMembersWithCreatorFirst } from "../lib/memberEmails";
import { documentNameFromUrl, isSafeExternalUrl, openExternalUrl } from "../lib/openUrl";
import type {
  ProjectConfigTab,
  ProjectDetail,
  ProjectDocument,
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

  const creatorEmail = user?.email ?? ownerEmail;

  const load = useCallback(async () => {
    if (!projectId) return;
    setError(null);
    const detail = await apiFetchWithRetry<ProjectDetail>(`/api/projects/${projectId}`);
    const next = detailToForm(detail, user?.email ?? detail.ownerEmail);
    setForm(next);
    setSaved(next);
    setIsOwner(Boolean(detail.isOwner));
    setCanManageProject(Boolean(detail.canManageProject));
    setCanManageLocks(Boolean(detail.canManageLocks));
    setLocks(detail.locks ?? DEFAULT_LOCKS);
    setOwnerEmail(detail.ownerEmail ?? null);
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
  }

  function toggleLock(key: keyof ProjectLocks) {
    setLocks((current) => ({ ...current, [key]: !current[key] }));
  }

  async function handleSave() {
    if (!projectId || !form || !canSave) return;

    const invalidDoc = form.documents.find(
      (doc) => doc.url.trim() && !isSafeExternalUrl(doc.url)
    );
    if (invalidDoc) {
      setError(`Enlace inválido en "${invalidDoc.name}": usá un enlace http(s)`);
      return;
    }
    if (form.backupLink.trim() && !isSafeExternalUrl(form.backupLink)) {
      setError("El enlace de respaldo debe ser http(s)");
      return;
    }
    if (form.gradesLink.trim() && !isSafeExternalUrl(form.gradesLink)) {
      setError("El enlace de calificaciones debe ser http(s)");
      return;
    }

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
    if (!isSafeExternalUrl(url)) {
      setError("Usá un enlace http(s) válido para el documento");
      return;
    }
    setError(null);
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
          <div className="project-config__locks-head">
            <h2 className="project-config__card-title">
              <Lock size={18} aria-hidden /> Control de secciones
            </h2>
            <p className="project-config__locks-hint">
              Cerralas para que los alumnos no puedan editarlas.
            </p>
          </div>
          <div className="project-config__locks-grid">
            {(
              [
                ["scope", "Alcance / Objetivo"],
                ["documentation", "Documentación"],
                ["team", "Equipo"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className={`project-config__toggle${
                  locks[key] ? " project-config__toggle--warn" : ""
                }`}
              >
                <span className="project-config__toggle-top">
                  <span className="project-config__toggle-icon" aria-hidden>
                    {locks[key] ? <Lock size={16} /> : <Unlock size={16} />}
                  </span>
                  <span className="project-config__toggle-name">{label}</span>
                  <span className="project-config__switch">
                    <input
                      type="checkbox"
                      checked={locks[key]}
                      onChange={() => toggleLock(key)}
                    />
                    <span className="project-config__switch-track" aria-hidden />
                  </span>
                </span>
                <span className="project-config__toggle-state">
                  {locks[key] ? "Cerrada para alumnos" : "Abierta"}
                </span>
              </label>
            ))}
          </div>
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
                <label
                  className={`project-config__toggle${
                    form.preprojectValidated ? " project-config__toggle--ok" : ""
                  }`}
                >
                  <span className="project-config__toggle-top">
                    <span className="project-config__toggle-icon" aria-hidden>
                      {form.preprojectValidated ? <BadgeCheck size={16} /> : <Circle size={16} />}
                    </span>
                    <span className="project-config__toggle-name">Proyecto Validado/Viable</span>
                    <span className="project-config__switch">
                      <input
                        type="checkbox"
                        checked={form.preprojectValidated}
                        onChange={(e) => patchForm({ preprojectValidated: e.target.checked })}
                        disabled={!canApprove}
                      />
                      <span className="project-config__switch-track" aria-hidden />
                    </span>
                  </span>
                  <span className="project-config__toggle-state">
                    {form.preprojectValidated ? "Validado" : "Sin validar"}
                  </span>
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
                <span className="project-config__label">Notas diarias por integrante</span>
                <p className="project-config__member-meta">
                  Cada nota es un registro con fecha y descripción. El promedio se calcula
                  automáticamente.
                </p>
                <ProjectGradesPanel projectId={projectId ?? ""} onChanged={() => void load()} />
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
