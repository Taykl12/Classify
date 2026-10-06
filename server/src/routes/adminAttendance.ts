import { Router } from "express";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { config } from "../config.js";
import { createAdminClient } from "../lib/supabase.js";
import { requireAdmin } from "../middleware/admin.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import {
  getZonedDateTime,
  isWorkday,
  isoWeekdayFromDate,
  normalizeDiasLaborables,
  normalizeTime,
  resolveDayStatus,
  type AttendanceConfig,
  type TeacherAttendanceStatus,
} from "../lib/attendance.js";
import {
  getAttendanceConfig,
  getProfessorRoleId,
  listProfessorProfiles,
  professorFullName,
  saveAttendanceConfig,
  type ProfessorRow,
} from "../lib/teacherAttendance.js";

const router = Router();

const VALID_STATES = new Set<TeacherAttendanceStatus>([
  "Presente",
  "Tardanza",
  "Ausente",
  "Justificado",
]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_INPUT_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

interface MarkingRow {
  id_asistencia_profesor: number;
  id_usuario: string;
  fecha: string;
  hora_entrada: string | null;
  estado: TeacherAttendanceStatus;
  metodo_registro: "Huella" | "Manual";
  huella_id: number | null;
  observaciones: string | null;
}

function statusFromError(e: unknown): number {
  return typeof e === "object" && e !== null && "status" in e
    ? Number((e as { status: unknown }).status) || 500
    : 500;
}

function messageFromError(e: unknown): string {
  return e instanceof Error ? e.message : "Error interno";
}

function toTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function todayInZone(): string {
  return getZonedDateTime(new Date(), getTimeZone()).fecha;
}

function getTimeZone(): string {
  return config.attendanceTimeZone;
}

async function listAuthEmailMap(
  supabase: SupabaseClient
): Promise<Map<string, string>> {
  const perPage = 1000;
  const byId = new Map<string, string>();
  for (let page = 1; page < 100; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    for (const user of data.users as User[]) {
      byId.set(user.id, user.email ?? "");
    }
    if (data.users.length < perPage) break;
  }
  return byId;
}

async function getProfessorOrThrow(
  supabase: SupabaseClient,
  professorRoleId: number,
  userId: string
): Promise<ProfessorRow> {
  const { data, error } = await supabase
    .from("usuarios")
    .select("id_usuario, nombre, apellido, foto_perfil, huella_id")
    .eq("id_usuario", userId)
    .eq("id_rol", professorRoleId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw Object.assign(new Error("Profesor no encontrado"), { status: 404 });
  }
  return data as ProfessorRow;
}

router.use(requireAuth, requireAdmin);

router.get("/config", async (_req, res) => {
  try {
    const supabase = createAdminClient();
    res.json({ config: await getAttendanceConfig(supabase) });
  } catch (e) {
    res.status(statusFromError(e)).json({ error: messageFromError(e) });
  }
});

router.put("/config", async (req, res) => {
  try {
    const { userId } = req as unknown as AuthedRequest;
    const body = req.body as Record<string, unknown>;
    const supabase = createAdminClient();
    const current = await getAttendanceConfig(supabase);

    const next: AttendanceConfig = { ...current };
    if ("horaEntrada" in body) {
      const value = toTrimmed(body.horaEntrada);
      if (!TIME_INPUT_RE.test(value)) {
        throw Object.assign(new Error("Hora de entrada inválida (HH:MM)"), { status: 400 });
      }
      next.horaEntrada = value;
    }
    if ("toleranciaMinutos" in body) {
      const value = Number(body.toleranciaMinutos);
      if (!Number.isInteger(value) || value < 0 || value > 240) {
        throw Object.assign(new Error("Tolerancia inválida (0–240 min)"), { status: 400 });
      }
      next.toleranciaMinutos = value;
    }
    if ("minutosAusencia" in body) {
      const value = Number(body.minutosAusencia);
      if (!Number.isInteger(value) || value < 0 || value > 720) {
        throw Object.assign(new Error("Límite de ausencia inválido (0–720 min)"), {
          status: 400,
        });
      }
      next.minutosAusencia = value;
    }
    if ("diasLaborables" in body) {
      next.diasLaborables = normalizeDiasLaborables(body.diasLaborables);
    }

    res.json({ config: await saveAttendanceConfig(supabase, next, userId) });
  } catch (e) {
    res.status(statusFromError(e)).json({ error: messageFromError(e) });
  }
});

router.get("/", async (req, res) => {
  try {
    const supabase = createAdminClient();
    const fechaRaw = toTrimmed(req.query.fecha);
    const fecha = DATE_RE.test(fechaRaw) ? fechaRaw : todayInZone();
    const query = toTrimmed(req.query.q).toLowerCase();
    const estadoFilter = toTrimmed(req.query.estado);

    const [professorRoleId, config] = await Promise.all([
      getProfessorRoleId(supabase),
      getAttendanceConfig(supabase),
    ]);
    if (professorRoleId === null) {
      throw Object.assign(new Error("Rol Profesor no configurado"), { status: 500 });
    }

    const [professors, emailById] = await Promise.all([
      listProfessorProfiles(supabase, professorRoleId),
      listAuthEmailMap(supabase),
    ]);

    const { data: markings, error: markingsError } = await supabase
      .from("asistencias_profesores")
      .select(
        "id_asistencia_profesor, id_usuario, fecha, hora_entrada, estado, metodo_registro, huella_id, observaciones"
      )
      .eq("fecha", fecha);
    if (markingsError) throw new Error(markingsError.message);

    const markingByUser = new Map<string, MarkingRow>();
    for (const row of (markings ?? []) as MarkingRow[]) {
      markingByUser.set(row.id_usuario, row);
    }

    const editingIds = new Set<number>();
    const markingIds = (markings ?? []).map(
      (row) => (row as MarkingRow).id_asistencia_profesor
    );
    if (markingIds.length > 0) {
      const { data: ajustes, error: ajustesError } = await supabase
        .from("asistencias_profesores_ajustes")
        .select("id_asistencia_profesor")
        .in("id_asistencia_profesor", markingIds);
      if (ajustesError) throw new Error(ajustesError.message);
      for (const row of ajustes ?? []) {
        editingIds.add((row as { id_asistencia_profesor: number }).id_asistencia_profesor);
      }
    }

    const now = getZonedDateTime(new Date(), getTimeZone());
    const isoWeekday = isoWeekdayFromDate(fecha);
    const esDiaLaborable = isWorkday(isoWeekday, config.diasLaborables);

    let registros = professors.map((professor) => {
      const marking = markingByUser.get(professor.id_usuario) ?? null;
      const estado = resolveDayStatus({
        fecha,
        record: marking
          ? { estado: marking.estado, horaEntrada: marking.hora_entrada }
          : null,
        config,
        now,
      });
      return {
        userId: professor.id_usuario,
        firstName: professor.nombre?.trim() ?? "",
        lastName: professor.apellido?.trim() ?? "",
        email: emailById.get(professor.id_usuario) ?? "",
        profilePhotoUrl: professor.foto_perfil,
        huellaId: professor.huella_id,
        fecha,
        horaEntrada: normalizeTime(marking?.hora_entrada ?? null),
        estado,
        metodo: marking?.metodo_registro ?? null,
        observaciones: marking?.observaciones?.trim() ?? "",
        corregido: marking ? editingIds.has(marking.id_asistencia_profesor) : false,
      };
    });

    if (query) {
      registros = registros.filter((row) =>
        [row.firstName, row.lastName, row.email].join(" ").toLowerCase().includes(query)
      );
    }
    if (estadoFilter) {
      registros = registros.filter((row) => row.estado === estadoFilter);
    }

    const resumen = {
      presentes: registros.filter((row) => row.estado === "Presente").length,
      tardanzas: registros.filter((row) => row.estado === "Tardanza").length,
      ausentes: registros.filter((row) => row.estado === "Ausente").length,
      justificados: registros.filter((row) => row.estado === "Justificado").length,
      sinMarcar: registros.filter((row) => row.estado === "Sin marcar").length,
      total: registros.length,
    };

    res.json({
      fecha,
      esDiaLaborable,
      horaEntradaEsperada: config.horaEntrada,
      resumen,
      registros,
    });
  } catch (e) {
    res.status(statusFromError(e)).json({ error: messageFromError(e) });
  }
});

router.get("/:userId/historial", async (req, res) => {
  try {
    const supabase = createAdminClient();
    const professorRoleId = await getProfessorRoleId(supabase);
    if (professorRoleId === null) {
      throw Object.assign(new Error("Rol Profesor no configurado"), { status: 500 });
    }
    const professor = await getProfessorOrThrow(
      supabase,
      professorRoleId,
      req.params.userId
    );

    const { data, error } = await supabase
      .from("asistencias_profesores")
      .select(
        "id_asistencia_profesor, fecha, hora_entrada, estado, metodo_registro, observaciones"
      )
      .eq("id_usuario", professor.id_usuario)
      .order("fecha", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);

    const ids = (data ?? []).map(
      (row) => (row as { id_asistencia_profesor: number }).id_asistencia_profesor
    );
    const corregidos = new Set<number>();
    if (ids.length > 0) {
      const { data: ajustes, error: ajustesError } = await supabase
        .from("asistencias_profesores_ajustes")
        .select("id_asistencia_profesor")
        .in("id_asistencia_profesor", ids);
      if (ajustesError) throw new Error(ajustesError.message);
      for (const row of ajustes ?? []) {
        corregidos.add((row as { id_asistencia_profesor: number }).id_asistencia_profesor);
      }
    }

    res.json({
      profesor: {
        userId: professor.id_usuario,
        firstName: professor.nombre?.trim() ?? "",
        lastName: professor.apellido?.trim() ?? "",
        profilePhotoUrl: professor.foto_perfil,
        huellaId: professor.huella_id,
        nombreCompleto: professorFullName(professor),
      },
      historial: (data ?? []).map((row) => {
        const item = row as {
          id_asistencia_profesor: number;
          fecha: string;
          hora_entrada: string | null;
          estado: TeacherAttendanceStatus;
          metodo_registro: "Huella" | "Manual";
          observaciones: string | null;
        };
        return {
          fecha: item.fecha,
          horaEntrada: normalizeTime(item.hora_entrada),
          estado: item.estado,
          metodo: item.metodo_registro,
          observaciones: item.observaciones?.trim() ?? "",
          corregido: corregidos.has(item.id_asistencia_profesor),
        };
      }),
    });
  } catch (e) {
    res.status(statusFromError(e)).json({ error: messageFromError(e) });
  }
});

router.post("/:userId/correccion", async (req, res) => {
  try {
    const { userId: actorId } = req as unknown as AuthedRequest;
    const supabase = createAdminClient();
    const professorRoleId = await getProfessorRoleId(supabase);
    if (professorRoleId === null) {
      throw Object.assign(new Error("Rol Profesor no configurado"), { status: 500 });
    }
    const professor = await getProfessorOrThrow(
      supabase,
      professorRoleId,
      req.params.userId
    );

    const body = req.body as Record<string, unknown>;
    const fechaRaw = toTrimmed(body.fecha);
    const fecha = DATE_RE.test(fechaRaw) ? fechaRaw : todayInZone();
    const estado = toTrimmed(body.estado) as TeacherAttendanceStatus;
    const motivo = toTrimmed(body.motivo);
    const horaRaw = toTrimmed(body.horaEntrada);

    if (!VALID_STATES.has(estado)) {
      throw Object.assign(new Error("Estado inválido"), { status: 400 });
    }
    if (motivo.length < 3) {
      throw Object.assign(new Error("Indicá un motivo de la corrección"), { status: 400 });
    }
    let horaEntrada: string | null = null;
    if (horaRaw) {
      if (!TIME_INPUT_RE.test(horaRaw)) {
        throw Object.assign(new Error("Hora inválida (HH:MM)"), { status: 400 });
      }
      horaEntrada = horaRaw;
    } else if (estado === "Presente" || estado === "Tardanza") {
      // Sin hora explícita, usamos la hora esperada como referencia.
      const config = await getAttendanceConfig(supabase);
      horaEntrada = config.horaEntrada;
    }

    const { data: existing, error: existingError } = await supabase
      .from("asistencias_profesores")
      .select(
        "id_asistencia_profesor, hora_entrada, estado, metodo_registro"
      )
      .eq("id_usuario", professor.id_usuario)
      .eq("fecha", fecha)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    const previous = existing as MarkingRow | null;

    let saved: MarkingRow;
    if (previous) {
      const { data: updated, error: updateError } = await supabase
        .from("asistencias_profesores")
        .update({
          estado,
          hora_entrada: horaEntrada,
          observaciones: motivo,
          id_registrado_por: actorId,
          actualizado_en: new Date().toISOString(),
        })
        .eq("id_asistencia_profesor", previous.id_asistencia_profesor)
        .select(
          "id_asistencia_profesor, id_usuario, fecha, hora_entrada, estado, metodo_registro, huella_id, observaciones"
        )
        .single();
      if (updateError) throw new Error(updateError.message);
      saved = updated as MarkingRow;
    } else {
      const { data: created, error: insertError } = await supabase
        .from("asistencias_profesores")
        .insert({
          id_usuario: professor.id_usuario,
          fecha,
          hora_entrada: horaEntrada,
          estado,
          metodo_registro: "Manual",
          id_registrado_por: actorId,
          observaciones: motivo,
        })
        .select(
          "id_asistencia_profesor, id_usuario, fecha, hora_entrada, estado, metodo_registro, huella_id, observaciones"
        )
        .single();
      if (insertError) throw new Error(insertError.message);
      saved = created as MarkingRow;
    }

    const { error: auditError } = await supabase
      .from("asistencias_profesores_ajustes")
      .insert({
        id_asistencia_profesor: saved.id_asistencia_profesor,
        estado_anterior: previous?.estado ?? null,
        hora_entrada_anterior: previous ? normalizeTime(previous.hora_entrada) : null,
        estado_nuevo: estado,
        hora_entrada_nuevo: horaEntrada,
        motivo,
        id_modificado_por: actorId,
      });
    if (auditError) throw new Error(auditError.message);

    res.status(previous ? 200 : 201).json({
      registro: {
        userId: professor.id_usuario,
        fecha: saved.fecha,
        horaEntrada: normalizeTime(saved.hora_entrada),
        estado: saved.estado,
        metodo: saved.metodo_registro,
        observaciones: saved.observaciones?.trim() ?? "",
        corregido: true,
      },
    });
  } catch (e) {
    res.status(statusFromError(e)).json({ error: messageFromError(e) });
  }
});

export default router;
