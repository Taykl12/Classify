export function openExternalUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  window.open(href, "_blank", "noopener,noreferrer");
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
