import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { ensureCreatorInMembers } from "../../lib/memberEmails";
import type { ProjectFormValues } from "../../types/projects";
import { EMPTY_PROJECT_FORM } from "../../types/projects";
import { EmailChipInput } from "./EmailChipInput";
import "../../styles/projects-modal.css";

interface ProjectFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  initialValues?: ProjectFormValues;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (values: ProjectFormValues) => void | Promise<void>;
}

interface ProjectFormModalContentProps {
  mode: "create" | "edit";
  initialValues?: ProjectFormValues;
  submitting: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (values: ProjectFormValues) => void | Promise<void>;
}

function buildInitialValues(
  initialValues: ProjectFormValues | undefined,
  creatorEmail: string | null
): ProjectFormValues {
  const base = initialValues ?? EMPTY_PROJECT_FORM;
  return {
    ...base,
    memberEmails: ensureCreatorInMembers(base.memberEmails, creatorEmail),
  };
}

function ProjectFormModalContent({
  mode,
  initialValues,
  submitting,
  error,
  onClose,
  onSubmit,
}: ProjectFormModalContentProps) {
  const { user } = useAuth();
  const creatorEmail = user?.email ?? null;
  const [values, setValues] = useState(() =>
    buildInitialValues(initialValues, creatorEmail)
  );
  const [memberInputOpen, setMemberInputOpen] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSubmit(values);
  }

  function toggleMemberInput() {
    setMemberInputOpen((open) => !open);
  }

  return (
    <div className="project-modal" role="presentation" onClick={onClose}>
      <div
        className="project-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <form className="project-modal__body" onSubmit={handleSubmit}>
          {error ? (
            <p className="project-modal__error" role="alert">
              {error}
            </p>
          ) : null}
          <label className="project-modal__label">
            Nombre del Proyecto
            <input
              type="text"
              className="project-modal__input"
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              required
              autoFocus={!memberInputOpen}
            />
          </label>

          <div className="project-modal__section">
            <span className="project-modal__label project-modal__label--static">
              Integrantes del Proyecto
            </span>

            {!memberInputOpen && values.memberEmails.length > 0 ? (
              <ul className="project-modal__member-preview" aria-label="Integrantes agregados">
                {values.memberEmails.map((email) => (
                  <li key={email} className="email-chips__chip email-chips__chip--preview">
                    <span className="email-chips__chip-text">{email}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {memberInputOpen ? (
              <div className="project-modal__member-panel" role="region" aria-label="Buscar integrantes">
                <EmailChipInput
                  emails={values.memberEmails}
                  onChange={(memberEmails) =>
                    setValues((v) => ({
                      ...v,
                      memberEmails: ensureCreatorInMembers(memberEmails, creatorEmail),
                    }))
                  }
                  placeholder="Ingrese el Correo del Usuario"
                  autoFocus
                />
              </div>
            ) : null}

            <button
              type="button"
              className={`project-modal__btn project-modal__btn--add${memberInputOpen ? " project-modal__btn--add-active" : ""}`}
              onClick={toggleMemberInput}
              aria-expanded={memberInputOpen}
            >
              <Plus size={18} strokeWidth={2.5} aria-hidden />
              Agregar Integrante
            </button>
          </div>

          <footer className="project-modal__footer project-modal__footer--split">
            <button
              type="button"
              className="project-modal__btn project-modal__btn--muted"
              onClick={onClose}
            >
              Descartar
            </button>
            <button
              type="submit"
              className="project-modal__btn project-modal__btn--primary"
              disabled={submitting}
            >
              {submitting ? "Guardando…" : mode === "create" ? "Crear" : "Guardar"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export function ProjectFormModal({
  open,
  mode,
  initialValues,
  submitting = false,
  error,
  onClose,
  onSubmit,
}: ProjectFormModalProps) {
  if (!open) return null;

  const formKey =
    mode === "edit"
      ? `${initialValues?.name ?? ""}:${(initialValues?.memberEmails ?? []).join(",")}`
      : "create";

  return (
    <ProjectFormModalContent
      key={formKey}
      mode={mode}
      initialValues={initialValues}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}
