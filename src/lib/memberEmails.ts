export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** El correo del creador queda primero en la lista (sin duplicar). */
export function sortMembersWithCreatorFirst(
  emails: string[],
  creatorEmail?: string | null
): string[] {
  if (!creatorEmail?.trim()) return [...emails];
  const creator = normalizeEmail(creatorEmail);
  const rest = emails
    .map(normalizeEmail)
    .filter((e) => e && e !== creator);
  return [creator, ...rest];
}

export function ensureCreatorInMembers(
  emails: string[],
  creatorEmail?: string | null
): string[] {
  return sortMembersWithCreatorFirst(emails, creatorEmail);
}
