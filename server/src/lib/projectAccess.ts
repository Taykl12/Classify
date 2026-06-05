import type { SupabaseClient } from "@supabase/supabase-js";

/** Proyectos donde el usuario es dueño (creador) o integrante. */
export async function getAccessibleGroupIds(
  supabase: SupabaseClient,
  userId: string
): Promise<number[]> {
  const [asOwner, asMember] = await Promise.all([
    supabase.from("proyecto_profesor").select("id_grupo").eq("id_profesor", userId),
    supabase.from("grupo_estudiante").select("id_grupo").eq("id_usuario", userId),
  ]);
  if (asOwner.error) throw new Error(asOwner.error.message);
  if (asMember.error) throw new Error(asMember.error.message);

  const ids = new Set<number>();
  for (const row of asOwner.data ?? []) ids.add(row.id_grupo as number);
  for (const row of asMember.data ?? []) ids.add(row.id_grupo as number);
  return [...ids];
}

/** @deprecated Usar getAccessibleGroupIds */
export const getOwnedGroupIds = getAccessibleGroupIds;

export async function assertCanAccessGroup(
  supabase: SupabaseClient,
  userId: string,
  idGrupo: number
): Promise<void> {
  const ids = await getAccessibleGroupIds(supabase, userId);
  if (!ids.includes(idGrupo)) {
    const err = new Error("Proyecto no encontrado");
    (err as Error & { status: number }).status = 404;
    throw err;
  }
}

/** Solo el creador del proyecto (proyecto_profesor) puede modificar o borrar. */
export async function isProjectOwner(
  supabase: SupabaseClient,
  userId: string,
  idGrupo: number
): Promise<boolean> {
  const { data, error } = await supabase
    .from("proyecto_profesor")
    .select("id_grupo")
    .eq("id_profesor", userId)
    .eq("id_grupo", idGrupo)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function assertIsProjectOwner(
  supabase: SupabaseClient,
  userId: string,
  idGrupo: number
): Promise<void> {
  const { data, error } = await supabase
    .from("proyecto_profesor")
    .select("id_grupo")
    .eq("id_profesor", userId)
    .eq("id_grupo", idGrupo)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    const err = new Error("No tenés permiso para modificar este proyecto");
    (err as Error & { status: number }).status = 403;
    throw err;
  }
}

/** @deprecated Usar assertCanAccessGroup o assertIsProjectOwner según el caso */
export const assertOwnsGroup = assertCanAccessGroup;

export function parseGroupId(id: string | string[] | undefined): number | null {
  const raw = Array.isArray(id) ? id[0] : id;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}
