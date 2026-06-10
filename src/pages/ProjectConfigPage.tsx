import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { ArrowLeft, ExternalLink, Plus, Trash2, User } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { EmailChipInput } from "../components/projects/EmailChipInput";
import { useAuth } from "../contexts/AuthContext";
import { ApiError, apiFetch, apiFetchWithRetry, isUnauthorizedError } from "../lib/api";
import { ensureCreatorInMembers, sortMembersWithCreatorFirst } from "../lib/memberEmails";
import { documentNameFromUrl, openExternalUrl } from "../lib/openUrl";
import { isProfessor } from "../lib/roles";
import type { ProjectConfigTab, ProjectDetail, ProjectDocument } from "../types/projects";
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

export default function ProjectConfigPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<ProjectConfigTab>("alcance");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
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

  function patchForm(patch: Partial<ConfigFormState>) {
    setForm((f) => (f ? { ...f, ...patch } : f));
  }

  function handleUndo() {
    if (saved) setForm({ ...saved });
  }

  async function handleSave() {
    if (!projectId || !form || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      const payload = isOwner
        ? {
            name: form.name,
            status: form.status,
            objective: form.objective,
            scopeDetail: form.scopeDetail,
            scopeNotes: form.scopeNotes,
            preprojectValidated: form.preprojectValidated,
            backupLink: form.backupLink,
            documents: form.documents,
            memberEmails: ensureCreatorInMembers(form.memberEmails, creatorEmail),
          }
        : { preprojectValidated: form.preprojectValidated };

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

  const isProf = isProfessor(user?.roleLabel);
  const readOnly = !isOwner;
  const canApprove = isProf;
  const canSave = isOwner || isProf;

  if (loading || !form) {
    return (
      <DashboardLayout>
        <p className="dashboard-loading">{loading ? "Cargando configuración…" : "Proyecto no encontrado"}</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
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

      <div className="project-config__layout">
        <aside className="project-config__milestones" aria-label="Hitos y estado">
          <div className="project-config__card">
            <h2 className="project-config__card-title">Hitos y Estado</h2>
            <p className="project-config__label">Estado Actual</p>
            <div className="project-config__status-pill">
              <select
                value={form.status}
                onChange={(e) =>
                  patchForm({ status: e.target.value as "Abierto" | "Cerrado" })
                }
                disabled={readOnly}
                aria-label="Estado del proyecto"
                style={{
                  border: "none",
                  background: "transparent",
                  font: "inherit",
                  fontWeight: 700,
                  color: "inherit",
                  flex: 1,
                }}
              >
                <option value="Abierto">Abierto</option>
                <option value="Cerrado">Cerrado</option>
              </select>
              <span className="project-config__status-dot" aria-hidden />
            </div>
          </div>
          <div className="project-config__card">
            <h2 className="project-config__card-title">Notas del Proyecto</h2>
            <textarea
              className="project-config__textarea"
              value={form.scopeNotes}
              onChange={(e) => patchForm({ scopeNotes: e.target.value })}
              placeholder="Notas de Alcance:"
              disabled={readOnly}
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
            <div>
              <label className="project-config__field">
                <span className="project-config__label">Titulo del Proyecto</span>
                <input
                  type="text"
                  className="project-config__input"
                  value={form.name}
                  onChange={(e) => patchForm({ name: e.target.value })}
                  disabled={readOnly}
                />
              </label>
              <label className="project-config__field">
                <span className="project-config__label">Objetivo General</span>
                <textarea
                  className="project-config__input project-config__input--area"
                  value={form.objective}
                  onChange={(e) => patchForm({ objective: e.target.value })}
                  disabled={readOnly}
                />
              </label>
              <label className="project-config__field">
                <span className="project-config__label">Alcance del Proyecto</span>
                <textarea
                  className="project-config__input project-config__input--area"
                  value={form.scopeDetail}
                  onChange={(e) => patchForm({ scopeDetail: e.target.value })}
                  disabled={readOnly}
                />
              </label>
            </div>
          ) : null}

          {tab === "equipo" ? (
            <div>
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
              {isOwner ? (
                <>
                  <div className="project-config__field" style={{ marginTop: "1.5rem" }}>
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
            <div>
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
                    Solo un usuario con rol Profesor puede aprobar el anteproyecto.
                  </p>
                ) : null}
              </div>
              <LinkField
                label="Documentacion de Respaldo"
                value={form.backupLink}
                onChange={(backupLink) => patchForm({ backupLink })}
                disabled={readOnly}
              />
            </div>
          ) : null}

          {tab === "documentaciones" ? (
            <div>
              <div className="project-config__field">
                <span className="project-config__label">Agregar Documento:</span>
                <div className="project-config__add-doc-row">
                  <input
                    type="text"
                    className="project-config__doc-name-input"
                    value={docNameDraft}
                    onChange={(e) => setDocNameDraft(e.target.value)}
                    placeholder="Nombre"
                    disabled={readOnly}
                    aria-label="Nombre del documento"
                  />
                  <input
                    type="url"
                    className="project-config__doc-url-input"
                    value={docDraft}
                    onChange={(e) => setDocDraft(e.target.value)}
                    onKeyDown={handleDocKeyDown}
                    placeholder="Ingrese el link del documento"
                    disabled={readOnly}
                    aria-label="Link del documento"
                  />
                  <button
                    type="button"
                    className="project-config__add-btn"
                    onClick={addDocument}
                    disabled={readOnly || !docDraft.trim()}
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
                      disabled={readOnly}
                      aria-label={`Nombre del documento ${doc.url}`}
                    />
                    <input
                      type="url"
                      className="project-config__doc-url-input"
                      value={doc.url}
                      onChange={(e) => updateDocument(index, { url: e.target.value })}
                      disabled={readOnly}
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
                      disabled={readOnly}
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
    </DashboardLayout>
  );
}
