import { useEffect, useRef } from "react";
import { isTopModal, pushModal, removeModal } from "../lib/modalStack";

/**
 * Cierra el modal con `Escape`, respetando el stack: solo responde el modal
 * que está arriba de todo. No usa listeners globales conflictivos: cada modal
 * registra el suyo mientras está abierto.
 */
export function useModalEscape(open: boolean, onClose: () => void): void {
  const tokenRef = useRef<symbol | null>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    if (!tokenRef.current) tokenRef.current = Symbol("modal");
    const token = tokenRef.current;
    pushModal(token);

    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (!isTopModal(token)) return;
      event.preventDefault();
      closeRef.current();
    };
    document.addEventListener("keydown", handler);

    return () => {
      removeModal(token);
      document.removeEventListener("keydown", handler);
    };
  }, [open]);
}
