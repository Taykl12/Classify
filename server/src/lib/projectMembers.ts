import type { SupabaseClient } from "@supabase/supabase-js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmails(raw: string[] | undefined): string[] {
  if (!raw?.length) return [];
  const seen = new Set<string>();
  for (const e of raw) {
    const n = e.trim().toLowerCase();
    if (n && EMAIL_RE.test(n)) seen.add(n);
  }
  return [...seen];
}

export async function getGroupMemberEmails(
  supabase: SupabaseClient,
  idGrupo: number
): Promise<string[]> {
  const { data, error } = await supabase.rpc("get_group_member_emails", {
    p_id_grupo: idGrupo,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { email: string }) => row.email);
}

export async function syncGroupMembers(
  supabase: SupabaseClient,
  idGrupo: number,
  emails: string[]
): Promise<{ notFound: string[] }> {
  const normalized = normalizeEmails(emails);
  const notFound: string[] = [];
  const userIds: string[] = [];

  for (const email of normalized) {
    const { data: userId, error } = await supabase.rpc("find_user_id_by_email", {
      p_email: email,
    });
    if (error || !userId) {
      notFound.push(email);
      continue;
    }
    userIds.push(userId as string);
  }

  const { error: delError } = await supabase
    .from("grupo_estudiante")
    .delete()
    .eq("id_grupo", idGrupo);
  if (delError) throw new Error(delError.message);

  if (userIds.length > 0) {
    const { error: insError } = await supabase.from("grupo_estudiante").insert(
      userIds.map((id_usuario) => ({ id_grupo: idGrupo, id_usuario }))
    );
    if (insError) throw new Error(insError.message);
  }

  return { notFound };
}
