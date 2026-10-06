import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_ATTENDANCE_CONFIG,
  normalizeDiasLaborables,
  normalizeTime,
  type AttendanceConfig,
} from "./attendance.js";

export interface AttendanceConfigRow {
  hora_entrada: string | null;
  tolerancia_minutos: number | null;
  minutos_ausencia: number | null;
  dias_laborables: number[] | null;
}

export interface ProfessorRow {
  id_usuario: string;
  nombre: string | null;
  apellido: string | null;
  foto_perfil: string | null;
  huella_id: number | null;
}

export async function getProfessorRoleId(
  supabase: SupabaseClient
): Promise<number | null> {
  const { data, error } = await supabase
    .from("roles")
    .select("id_rol")
    .eq("nombre_rol", "profesor")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { id_rol: number } | null)?.id_rol ?? null;
}

function mapConfigRow(row: AttendanceConfigRow | null): AttendanceConfig {
  if (!row) return { ...DEFAULT_ATTENDANCE_CONFIG };
  return {
    horaEntrada:
      normalizeTime(row.hora_entrada) ?? DEFAULT_ATTENDANCE_CONFIG.horaEntrada,
    toleranciaMinutos:
      typeof row.tolerancia_minutos === "number"
        ? row.tolerancia_minutos
        : DEFAULT_ATTENDANCE_CONFIG.toleranciaMinutos,
    minutosAusencia:
      typeof row.minutos_ausencia === "number"
        ? row.minutos_ausencia
        : DEFAULT_ATTENDANCE_CONFIG.minutosAusencia,
    diasLaborables: normalizeDiasLaborables(row.dias_laborables),
  };
}

export async function getAttendanceConfig(
  supabase: SupabaseClient
): Promise<AttendanceConfig> {
  const { data, error } = await supabase
    .from("configuracion_asistencia")
    .select("hora_entrada, tolerancia_minutos, minutos_ausencia, dias_laborables")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return mapConfigRow(data as AttendanceConfigRow | null);
}

export async function saveAttendanceConfig(
  supabase: SupabaseClient,
  config: AttendanceConfig,
  actorId: string | null
): Promise<AttendanceConfig> {
  const { data, error } = await supabase
    .from("configuracion_asistencia")
    .upsert(
      {
        id: 1,
        hora_entrada: config.horaEntrada,
        tolerancia_minutos: config.toleranciaMinutos,
        minutos_ausencia: config.minutosAusencia,
        dias_laborables: config.diasLaborables,
        id_actualizado_por: actorId,
        actualizado_en: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select("hora_entrada, tolerancia_minutos, minutos_ausencia, dias_laborables")
    .single();
  if (error) throw new Error(error.message);
  return mapConfigRow(data as AttendanceConfigRow);
}

export async function listProfessorProfiles(
  supabase: SupabaseClient,
  professorRoleId: number
): Promise<ProfessorRow[]> {
  const { data, error } = await supabase
    .from("usuarios")
    .select("id_usuario, nombre, apellido, foto_perfil, huella_id")
    .eq("id_rol", professorRoleId)
    .order("apellido", { ascending: true })
    .order("nombre", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProfessorRow[];
}

export async function findProfessorByHuella(
  supabase: SupabaseClient,
  professorRoleId: number,
  huellaId: number
): Promise<ProfessorRow | null> {
  const { data, error } = await supabase
    .from("usuarios")
    .select("id_usuario, nombre, apellido, foto_perfil, huella_id")
    .eq("huella_id", huellaId)
    .eq("id_rol", professorRoleId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ProfessorRow | null) ?? null;
}

export function professorFullName(row: {
  nombre: string | null;
  apellido: string | null;
}): string {
  return [row.nombre, row.apellido].filter(Boolean).join(" ").trim() || "Profesor";
}
