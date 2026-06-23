import type { SupabaseClient } from "@supabase/supabase-js";
import type { GrupoProyectoRow } from "./mappers.js";

export interface ProjectLocksDto {
  scope: boolean;
  documentation: boolean;
  team: boolean;
}

export interface ProjectLocksBody {
  scope?: boolean;
  documentation?: boolean;
  team?: boolean;
}

interface AssignedProfessorRow {
  id_grupo: number;
  id_profesor: string;
}

export function mapProjectLocks(row: GrupoProyectoRow): ProjectLocksDto {
  return {
    scope: Boolean(row.bloqueo_alcance),
    documentation: Boolean(row.bloqueo_documentacion),
    team: Boolean(row.bloqueo_equipo),
  };
}

export function locksToDbPatch(locks: ProjectLocksBody): Record<string, boolean> {
  const patch: Record<string, boolean> = {};
  if (locks.scope !== undefined) patch.bloqueo_alcance = locks.scope;
  if (locks.documentation !== undefined) patch.bloqueo_documentacion = locks.documentation;
  if (locks.team !== undefined) patch.bloqueo_equipo = locks.team;
  return patch;
}

export function readLocksPayload(body: unknown): ProjectLocksBody {
  const raw = body as Record<string, unknown>;
  const locks = raw.locks as Record<string, unknown> | undefined;
  if (!locks || typeof locks !== "object") return {};
  return {
    scope: typeof locks.scope === "boolean" ? locks.scope : undefined,
    documentation: typeof locks.documentation === "boolean" ? locks.documentation : undefined,
    team: typeof locks.team === "boolean" ? locks.team : undefined,
  };
}

export async function getAssignedProfessorIds(
  supabase: SupabaseClient,
  idGrupo: number
): Promise<string[]> {
  const { data, error } = await supabase
    .from("proyecto_profesor_asignado")
    .select("id_profesor")
    .eq("id_grupo", idGrupo);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.id_profesor as string);
}

export async function isAssignedProfessor(
  supabase: SupabaseClient,
  userId: string,
  idGrupo: number
): Promise<boolean> {
  const { data, error } = await supabase
    .from("proyecto_profesor_asignado")
    .select("id_profesor")
    .eq("id_grupo", idGrupo)
    .eq("id_profesor", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function getAssignedProfessorIdsByGroups(
  supabase: SupabaseClient,
  groupIds: number[]
): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();
  if (groupIds.length === 0) return map;
  const { data, error } = await supabase
    .from("proyecto_profesor_asignado")
    .select("id_grupo, id_profesor")
    .in("id_grupo", groupIds);
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as AssignedProfessorRow[]) {
    const idGrupo = row.id_grupo;
    const list = map.get(idGrupo) ?? [];
    list.push(row.id_profesor);
    map.set(idGrupo, list);
  }
  return map;
}

export async function getAssignedProfessorEmails(
  supabase: SupabaseClient,
  idGrupo: number
): Promise<string[]> {
  const { data, error } = await supabase.rpc("get_assigned_professor_emails", {
    p_id_grupo: idGrupo,
  });
  if (error) return [];
  return Array.isArray(data) ? (data as string[]) : [];
}
