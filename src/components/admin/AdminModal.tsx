import type { ReactNode } from "react";
import "../../styles/projects-modal.css";

interface AdminModalProps {
  open: boolean;
  title: string;
  error?: string | null;
  children: ReactNode;
  footer: ReactNode;
  onClose: () => void;
}

export function AdminModal({
  open,
  title,
  error,
  children,
  footer,
  onClose,
}: AdminModalProps) {
  if (!open) return null;

  return (
    <div className="project-modal" role="presentation" onClick={onClose}>
      <div
        className="project-modal__dialog admin-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="project-modal__body">
          <h2 id="admin-modal-title" className="project-modal__title">
            {title}
          </h2>
          {error ? (
            <p className="project-modal__error" role="alert">
              {error}
            </p>
          ) : null}
          {children}
          <footer className="project-modal__footer project-modal__footer--split">
            {footer}
          </footer>
        </div>
      </div>
    </div>
  );
}
