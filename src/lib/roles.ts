export function isProfessor(roleLabel?: string | null): boolean {
  return roleLabel?.trim().toLowerCase() === "profesor";
}

export function isAdmin(roleLabel?: string | null): boolean {
  return roleLabel?.trim().toLowerCase() === "admin";
}

export function landingRouteForRole(roleLabel: string | null | undefined): "/admin" | "/dashboard" {
  return isAdmin(roleLabel) ? "/admin" : "/dashboard";
}
