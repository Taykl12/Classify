export function isProfessor(roleLabel?: string | null): boolean {
  return roleLabel?.trim().toLowerCase() === "profesor";
}

export function isAdmin(roleLabel?: string | null): boolean {
  return roleLabel?.trim().toLowerCase() === "admin";
}

export function landingRouteForRole(
  roleLabel: string | null | undefined
): "/admin" | "/profesor" | "/dashboard" {
  if (isAdmin(roleLabel)) return "/admin";
  if (isProfessor(roleLabel)) return "/profesor";
  return "/dashboard";
}

/** Etiqueta del rol lista para mostrar en UI (`"profesor"` → `"Profesor"`). */
export function roleDisplayLabel(roleLabel?: string | null): string {
  const raw = roleLabel?.trim();
  if (!raw) return "Sin rol";
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}
