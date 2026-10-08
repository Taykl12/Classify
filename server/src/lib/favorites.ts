import type { SupabaseClient } from "@supabase/supabase-js";

/** IDs de los proyectos que el usuario marcó como favoritos. */
export async function getFavoriteGroupIds(
  supabase: SupabaseClient,
  userId: string
): Promise<Set<number>> {
  const { data, error } = await supabase
    .from("proyecto_favorito")
    .select("id_grupo")
    .eq("id_usuario", userId);
  if (error) throw new Error(error.message);
  return new Set(
    (data ?? []).map((row) => (row as { id_grupo: number }).id_grupo)
  );
}

/** ¿El usuario marcó este proyecto como favorito? */
export async function isFavoriteProyecto(
  supabase: SupabaseClient,
  userId: string,
  idGrupo: number
): Promise<boolean> {
  const { data, error } = await supabase
    .from("proyecto_favorito")
    .select("id_favorito")
    .eq("id_usuario", userId)
    .eq("id_grupo", idGrupo)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

