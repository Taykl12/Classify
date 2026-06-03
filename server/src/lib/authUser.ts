import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuthUserDto {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  roleLabel?: string;
}

function roleNameFromJoin(
  roles: { nombre_rol: string } | { nombre_rol: string }[] | null | undefined
): string | undefined {
  if (!roles) return undefined;
  const raw = Array.isArray(roles) ? roles[0]?.nombre_rol : roles.nombre_rol;
  if (!raw) return undefined;
  const n = raw.trim().toLowerCase();
  return n.charAt(0).toUpperCase() + n.slice(1);
}

export async function buildAuthUser(
  userClient: SupabaseClient,
  userId: string,
  options?: { email?: string; nombre?: string; apellido?: string; roleLabel?: string }
): Promise<AuthUserDto> {
  if (options?.roleLabel) {
    return {
      id: userId,
      email: options.email,
      firstName: options.nombre,
      lastName: options.apellido,
      roleLabel: options.roleLabel,
    };
  }

  const { data: perfil } = await userClient
    .from("usuarios")
    .select("nombre, apellido, roles(nombre_rol)")
    .eq("id_usuario", userId)
    .maybeSingle();

  return {
    id: userId,
    email: options?.email,
    firstName: perfil?.nombre ?? options?.nombre,
    lastName: perfil?.apellido ?? options?.apellido,
    roleLabel: roleNameFromJoin(
      perfil?.roles as { nombre_rol: string } | { nombre_rol: string }[] | null | undefined
    ),
  };
}
