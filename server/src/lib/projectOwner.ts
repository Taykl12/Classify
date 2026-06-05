import type { SupabaseClient } from "@supabase/supabase-js";

export async function getProjectOwnerEmail(
  supabase: SupabaseClient,
  idGrupo: number
): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_project_owner_email", {
    p_id_grupo: idGrupo,
  });
  if (error) throw new Error(error.message);
  return data ? String(data).toLowerCase() : null;
}
