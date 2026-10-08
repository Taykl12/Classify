/**
 * Validación/normalización de entradas de texto y URLs.
 *
 * Nota XSS: el frontend es React y renderiza todo como texto (no usa
 * `dangerouslySetInnerHTML`), por lo que `<script>` se muestra literal y no se
 * ejecuta. Aun así validamos en backend: longitud, caracteres de control y
 * esquemas de URL seguros (evita `javascript:` en links de documentos).
 */

const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function readText(value: unknown, maxLen: number): string {
  const raw = typeof value === "string" ? value : "";
  return raw.replace(CONTROL_CHARS_RE, "").trim().slice(0, maxLen);
}

export function optionalText(value: unknown, maxLen: number): string | null {
  const text = readText(value, maxLen);
  return text || null;
}

/** Solo se aceptan `http:` y `https:`. Rechaza `javascript:`, `data:`, etc. */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function badUrl(label: string): Error {
  return Object.assign(
    new Error(`${label}: usá un enlace http(s) válido`),
    { status: 400 }
  );
}

/** URL obligatoria y segura (http/https). */
export function readHttpUrl(value: unknown, label: string, maxLen = 2000): string {
  const text = readText(value, maxLen);
  if (!text || !isSafeHttpUrl(text)) throw badUrl(label);
  return text;
}

/** URL opcional y segura; vacío → null. */
export function optionalHttpUrl(
  value: unknown,
  label: string,
  maxLen = 2000
): string | null {
  const text = readText(value, maxLen);
  if (!text) return null;
  if (!isSafeHttpUrl(text)) throw badUrl(label);
  return text;
}
