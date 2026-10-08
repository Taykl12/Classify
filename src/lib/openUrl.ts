const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

/** ¿Es una URL segura (http/https) para abrir en una pestaña nueva? */
export function isSafeExternalUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  const candidate = SCHEME_RE.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Abre un enlace externo. Rechaza esquemas peligrosos (`javascript:`, `data:`, …);
 * si no trae esquema, asume `https://`.
 */
export function openExternalUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  const candidate = SCHEME_RE.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  window.open(url.toString(), "_blank", "noopener,noreferrer");
  return true;
}

export function documentNameFromUrl(url: string): string {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    const segment = u.pathname.split("/").filter(Boolean).pop();
    return segment || url;
  } catch {
    return url.slice(0, 48) || "Documento";
  }
}
