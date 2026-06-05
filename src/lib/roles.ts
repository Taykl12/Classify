export function isProfessor(roleLabel?: string | null): boolean {
  return roleLabel?.trim().toLowerCase() === "profesor";
}
