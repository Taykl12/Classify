import { Router } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth, getUserSupabase } from "../middleware/auth.js";
import { getAccessibleGroupIds, getManagedGroupIds } from "../lib/projectAccess.js";
import { readText, optionalText } from "../lib/validation.js";

const router = Router();

const EVENT_SELECT =
  "id_evento, titulo_evento, descripcion_evento, fecha_evento, prioridad_evento, id_grupo, hora_inicio, hora_fin, recurrencia, id_creado_por, grupos_proyectos(nombre_proyecto)";

const PRIORITIES = new Set(["Baja", "Media", "Alta"]);
const RECURRENCES = new Set(["Ninguna", "Diaria", "Semanal", "Mensual"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

interface EventRow {
  id_evento: number;
  titulo_evento: string | null;
  descripcion_evento: string | null;
  fecha_evento: string;
  prioridad_evento: string | null;
  id_grupo: number;
  hora_inicio: string | null;
  hora_fin: string | null;
  recurrencia: string | null;
  id_creado_por: string;
  grupos_proyectos?:
    | { nombre_proyecto: string }
    | { nombre_proyecto: string }[]
    | null;
}

interface TaskRow {
  id_tarea: number;
  titulo_tarea: string | null;
  descripcion_tarea: string | null;
  fecha_limite: string | null;
  prioridad_tarea: string | null;
  estado_tarea: string | null;
  id_grupo: number;
  grupos_proyectos?:
    | { nombre_proyecto: string }
    | { nombre_proyecto: string }[]
    | null;
}

function projectNameFromJoin(
  gp: EventRow["grupos_proyectos"]
): string {
  if (!gp) return "Proyecto";
  return Array.isArray(gp)
    ? (gp[0]?.nombre_proyecto ?? "Proyecto")
    : (gp.nombre_proyecto ?? "Proyecto");
}

function normalizeTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = String(value).match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : null;
}

function dateOnly(value: string): string {
  return String(value).split("T")[0] ?? String(value);
}

function statusFromError(e: unknown): number {
  return typeof e === "object" && e !== null && "status" in e
    ? Number((e as { status: unknown }).status) || 500
    : 500;
}

function messageFromError(e: unknown): string {
  return e instanceof Error ? e.message : "Error interno";
}

function badRequest(message: string): Error {
  return Object.assign(new Error(message), { status: 400 });
}

function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

function readProjectId(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw badRequest("projectId inválido");
  }
  return parsed;
}

function readPriority(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "Media";
  if (!PRIORITIES.has(raw)) throw badRequest("Prioridad inválida");
  return raw;
}

function readRecurrence(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "Ninguna";
  if (!RECURRENCES.has(raw)) throw badRequest("Recurrencia inválida");
  return raw;
}

function readEventDate(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!isValidDate(raw)) throw badRequest("Fecha inválida (YYYY-MM-DD)");
  return raw;
}

function readOptionalHour(value: unknown, label: string): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  if (!TIME_RE.test(raw)) throw badRequest(`${label} inválida (HH:MM)`);
  return raw.slice(0, 5);
}

function mapEventRow(
  row: EventRow,
  userId: string,
  managed: { isAdmin: boolean; ids: Set<number> }
): Record<string, unknown> {
  const canEdit =
    row.id_creado_por === userId ||
    managed.isAdmin ||
    managed.ids.has(row.id_grupo);
  return {
    id: String(row.id_evento),
    title: row.titulo_evento?.trim() || "Evento sin título",
    description: row.descripcion_evento?.trim() || "",
    date: dateOnly(row.fecha_evento),
    projectId: String(row.id_grupo),
    projectName: projectNameFromJoin(row.grupos_proyectos),
    type: "event",
    priority: row.prioridad_evento ?? "Media",
    horaInicio: normalizeTime(row.hora_inicio),
    horaFin: normalizeTime(row.hora_fin),
    recurrencia: row.recurrencia ?? "Ninguna",
    readOnly: false,
    canEdit,
  };
}

function mapTaskRow(row: TaskRow): Record<string, unknown> {
  return {
    id: `task-${row.id_tarea}`,
    taskId: String(row.id_tarea),
    title: row.titulo_tarea?.trim() || row.descripcion_tarea?.trim() || "Tarea",
    description: row.descripcion_tarea?.trim() || "",
    date: dateOnly(row.fecha_limite ?? ""),
    projectId: String(row.id_grupo),
    projectName: projectNameFromJoin(row.grupos_proyectos),
    type: "task",
    priority: row.prioridad_tarea ?? "Media",
    estado: row.estado_tarea ?? "Pendiente",
    horaInicio: null,
    horaFin: null,
    recurrencia: "Ninguna",
    readOnly: true,
    canEdit: false,
  };
}

async function loadManaged(supabase: SupabaseClient, userId: string) {
  return getManagedGroupIds(supabase, userId);
}

async function fetchEventById(
  supabase: SupabaseClient,
  idEvento: number,
  userId: string,
  managed: { isAdmin: boolean; ids: Set<number> }
) {
  const { data, error } = await supabase
    .from("eventos_calendario")
    .select(EVENT_SELECT)
    .eq("id_evento", idEvento)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapEventRow(data as EventRow, userId, managed) : null;
}

router.get("/events", requireAuth, async (req, res) => {
  try {
    const { userId } = req as AuthedRequest;
    const supabase = getUserSupabase(req as AuthedRequest);
    const [ids, managed] = await Promise.all([
      getAccessibleGroupIds(supabase, userId),
      loadManaged(supabase, userId),
    ]);
    const canSeeAll = managed.isAdmin;
    if (!canSeeAll && ids.length === 0) {
      res.json([]);
      return;
    }

    let eventQuery = supabase
      .from("eventos_calendario")
      .select(EVENT_SELECT)
      .order("fecha_evento", { ascending: true });
    if (!canSeeAll) eventQuery = eventQuery.in("id_grupo", ids);

    let taskQuery = supabase
      .from("tareas_grupo")
      .select(
        "id_tarea, titulo_tarea, descripcion_tarea, fecha_limite, prioridad_tarea, estado_tarea, id_grupo, grupos_proyectos(nombre_proyecto)"
      )
      .not("fecha_limite", "is", null);
    if (!canSeeAll) taskQuery = taskQuery.in("id_grupo", ids);

    const [eventosResult, tareasResult] = await Promise.all([eventQuery, taskQuery]);
    if (eventosResult.error) throw new Error(eventosResult.error.message);
    if (tareasResult.error) throw new Error(tareasResult.error.message);

    const events = ((eventosResult.data ?? []) as EventRow[]).map((row) =>
      mapEventRow(row, userId, managed)
    );
    const tasks = ((tareasResult.data ?? []) as TaskRow[]).map(mapTaskRow);

    res.json([...events, ...tasks]);
  } catch (e) {
    res.status(statusFromError(e)).json({ error: messageFromError(e) });
  }
});

router.post("/events", requireAuth, async (req, res) => {
  try {
    const { userId } = req as AuthedRequest;
    const body = req.body as Record<string, unknown>;
    const projectId = readProjectId(body.projectId);
    const title = readText(body.title, 150);
    if (!title) throw badRequest("El título es obligatorio");
    const description = optionalText(body.description, 5000);
    const priority = readPriority(body.priority);
    const eventDate = readEventDate(body.eventDate);
    const horaInicio = readOptionalHour(body.horaInicio, "Hora de inicio");
    const horaFin = readOptionalHour(body.horaFin, "Hora de fin");
    const recurrencia = readRecurrence(body.recurrencia);
    if (horaInicio && horaFin && horaFin <= horaInicio) {
      throw badRequest("La hora de fin debe ser posterior a la de inicio");
    }

    const supabase = getUserSupabase(req as AuthedRequest);
    const { data, error } = await supabase.rpc("create_evento_calendario", {
      p_id_grupo: projectId,
      p_titulo: title,
      p_fecha_evento: eventDate,
      p_descripcion: description,
      p_prioridad: priority,
      p_hora_inicio: horaInicio,
      p_hora_fin: horaFin,
      p_recurrencia: recurrencia,
    });
    if (error) throw Object.assign(new Error(error.message), { status: 400 });

    const idEvento = Number(
      (data as { id_evento?: number } | null)?.id_evento
    );
    if (!Number.isInteger(idEvento)) throw new Error("No se pudo crear el evento");

    const managed = await loadManaged(supabase, userId);
    const event = await fetchEventById(supabase, idEvento, userId, managed);
    res.status(201).json(event);
  } catch (e) {
    res.status(statusFromError(e)).json({ error: messageFromError(e) });
  }
});

// Export .ics (antes de /events/:id para que no lo capture el parámetro).
router.get("/events/export.ics", requireAuth, async (req, res) => {
  try {
    const { userId } = req as AuthedRequest;
    const supabase = getUserSupabase(req as AuthedRequest);
    const [ids, managed] = await Promise.all([
      getAccessibleGroupIds(supabase, userId),
      loadManaged(supabase, userId),
    ]);
    const canSeeAll = managed.isAdmin;
    if (!canSeeAll && ids.length === 0) {
      res.type("text/calendar").send(buildIcs([]));
      return;
    }

    const projectFilter = req.query.projectId ? Number(req.query.projectId) : null;
    const query = readText(req.query.q, 100).toLowerCase();

    let eventQuery = supabase
      .from("eventos_calendario")
      .select(EVENT_SELECT)
      .order("fecha_evento", { ascending: true });
    if (!canSeeAll) eventQuery = eventQuery.in("id_grupo", ids);
    if (projectFilter && Number.isInteger(projectFilter)) {
      eventQuery = eventQuery.eq("id_grupo", projectFilter);
    }

    const { data, error } = await eventQuery;
    if (error) throw new Error(error.message);

    let events = ((data ?? []) as EventRow[]).map((row) =>
      mapEventRow(row, userId, managed)
    );
    if (query) {
      events = events.filter((event) =>
        `${event.title} ${event.projectName}`.toLowerCase().includes(query)
      );
    }

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="classify.ics"');
    res.send(buildIcs(events));
  } catch (e) {
    res.status(statusFromError(e)).json({ error: messageFromError(e) });
  }
});

router.patch("/events/:id", requireAuth, async (req, res) => {
  try {
    const { userId } = req as AuthedRequest;
    const idEvento = Number(req.params.id);
    if (!Number.isInteger(idEvento) || idEvento <= 0) {
      throw badRequest("ID inválido");
    }
    const body = req.body as Record<string, unknown>;

    const patch: Record<string, unknown> = {};
    if ("title" in body) {
      const title = readText(body.title, 150);
      if (!title) throw badRequest("El título es obligatorio");
      patch.titulo_evento = title;
    }
    if ("description" in body) {
      patch.descripcion_evento = optionalText(body.description, 5000);
    }
    if ("priority" in body) patch.prioridad_evento = readPriority(body.priority);
    if ("eventDate" in body) patch.fecha_evento = readEventDate(body.eventDate);
    if ("horaInicio" in body) {
      patch.hora_inicio = readOptionalHour(body.horaInicio, "Hora de inicio");
    }
    if ("horaFin" in body) {
      patch.hora_fin = readOptionalHour(body.horaFin, "Hora de fin");
    }
    if ("recurrencia" in body) patch.recurrencia = readRecurrence(body.recurrencia);

    const inicio = patch.hora_inicio as string | null | undefined;
    const fin = patch.hora_fin as string | null | undefined;
    if (inicio && fin && fin <= inicio) {
      throw badRequest("La hora de fin debe ser posterior a la de inicio");
    }

    if (Object.keys(patch).length === 0) throw badRequest("Nada para actualizar");

    const supabase = getUserSupabase(req as AuthedRequest);
    const { data, error } = await supabase
      .from("eventos_calendario")
      .update(patch)
      .eq("id_evento", idEvento)
      .select("id_evento")
      .maybeSingle();
    if (error) throw Object.assign(new Error(error.message), { status: 400 });
    if (!data) {
      throw Object.assign(new Error("Evento no encontrado o sin permiso"), { status: 404 });
    }

    const managed = await loadManaged(supabase, userId);
    const event = await fetchEventById(supabase, idEvento, userId, managed);
    res.json(event);
  } catch (e) {
    res.status(statusFromError(e)).json({ error: messageFromError(e) });
  }
});

router.delete("/events/:id", requireAuth, async (req, res) => {
  try {
    const idEvento = Number(req.params.id);
    if (!Number.isInteger(idEvento) || idEvento <= 0) {
      throw badRequest("ID inválido");
    }
    const supabase = getUserSupabase(req as AuthedRequest);
    const { data, error } = await supabase
      .from("eventos_calendario")
      .delete()
      .eq("id_evento", idEvento)
      .select("id_evento")
      .maybeSingle();
    if (error) throw Object.assign(new Error(error.message), { status: 400 });
    if (!data) {
      throw Object.assign(new Error("Evento no encontrado o sin permiso"), { status: 404 });
    }
    res.json({ deleted: String(idEvento) });
  } catch (e) {
    res.status(statusFromError(e)).json({ error: messageFromError(e) });
  }
});

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function buildIcs(events: Record<string, unknown>[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Classify//Calendario//ES",
    "CALSCALE:GREGORIAN",
  ];
  for (const event of events) {
    const date = String(event.date ?? "").replace(/-/g, "");
    if (!date) continue;
    const inicio = event.horaInicio as string | null;
    const fin = event.horaFin as string | null;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:event-${event.id}@classify`);
    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`);
    if (inicio) {
      const start = `${date}T${inicio.replace(":", "")}00`;
      const end = fin ? `${date}T${fin.replace(":", "")}00` : start;
      lines.push(`DTSTART:${start}`);
      lines.push(`DTEND:${end}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${date}`);
    }
    lines.push(`SUMMARY:${escapeIcsText(String(event.title ?? "Evento"))}`);
    const description = String(event.description ?? "");
    if (description) {
      lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
    }
    lines.push(`CATEGORIES:${escapeIcsText(String(event.projectName ?? "Proyecto"))}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export default router;
