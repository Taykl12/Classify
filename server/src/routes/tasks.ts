import { Router } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth, getUserSupabase } from "../middleware/auth.js";
import { assertCanAccessGroup, parseGroupId } from "../lib/projectAccess.js";
import { readText, optionalText } from "../lib/validation.js";

const router = Router();

const PRIORITIES = new Set(["Baja", "Media", "Alta"]);
const STATUSES = new Set(["Pendiente", "En Progreso", "Completado"]);

interface TaskRow {
  id_tarea: number;
  id_grupo: number;
  titulo_tarea: string | null;
  descripcion_tarea: string | null;
  prioridad_tarea: string | null;
  estado_tarea: string | null;
  fecha_limite: string | null;
  id_creado_por: string | null;
  fecha_creacion: string | null;
}

const TASK_SELECT =
  "id_tarea, id_grupo, titulo_tarea, descripcion_tarea, prioridad_tarea, estado_tarea, fecha_limite, id_creado_por, fecha_creacion";

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

function mapTask(row: TaskRow) {
  return {
    id: String(row.id_tarea),
    projectId: String(row.id_grupo),
    title: row.titulo_tarea?.trim() || "Tarea sin título",
    description: row.descripcion_tarea?.trim() || "",
    priority: row.prioridad_tarea ?? "Media",
    status: row.estado_tarea ?? "Pendiente",
    deadline: row.fecha_limite ? String(row.fecha_limite).split("T")[0] : null,
    createdAt: row.fecha_creacion ?? null,
    createdBy: row.id_creado_por,
  };
}

function readDeadline(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) throw badRequest("Fecha límite inválida");
  return parsed.toISOString();
}

function taskIdParam(raw: string | string[]): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function fetchTask(
  supabase: SupabaseClient,
  taskId: number
): Promise<TaskRow | null> {
  const { data, error } = await supabase
    .from("tareas_grupo")
    .select(TASK_SELECT)
    .eq("id_tarea", taskId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as TaskRow | null) ?? null;
}

/** Lista tareas de un proyecto (accesible por dueño, integrante, asignado o admin). */
router.get("/:projectId", requireAuth, async (req, res) => {
  try {
    const { userId } = req as AuthedRequest;
    const projectId = parseGroupId(req.params.projectId);
    if (!projectId) throw badRequest("Proyecto inválido");
    const supabase = getUserSupabase(req as AuthedRequest);
    await assertCanAccessGroup(supabase, userId, projectId);

    const { data, error } = await supabase
      .from("tareas_grupo")
      .select(TASK_SELECT)
      .eq("id_grupo", projectId)
      .order("fecha_limite", { ascending: true, nullsFirst: false })
      .order("fecha_creacion", { ascending: false });
    if (error) throw new Error(error.message);
    res.json({ tasks: ((data ?? []) as TaskRow[]).map(mapTask) });
  } catch (e) {
    res.status(statusFromError(e)).json({ error: messageFromError(e) });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const supabase = getUserSupabase(req as AuthedRequest);
    const body = req.body as Record<string, unknown>;

    const projectId = Number(body.projectId);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      throw badRequest("projectId inválido");
    }
    const title = readText(body.title, 150);
    if (!title) throw badRequest("El título de la tarea es obligatorio");
    const description = optionalText(body.description, 5000);
    const priorityRaw = typeof body.priority === "string" ? body.priority.trim() : "";
    const priority = priorityRaw || "Media";
    if (!PRIORITIES.has(priority)) throw badRequest("Prioridad inválida");
    const deadline = readDeadline(body.deadline);

    const { data, error } = await supabase.rpc("create_tarea_grupo", {
      p_id_grupo: projectId,
      p_titulo: title,
      p_descripcion: description,
      p_prioridad: priority,
      p_fecha_limite: deadline,
    });
    if (error) throw Object.assign(new Error(error.message), { status: 400 });

    const created = data as TaskRow | null;
    res.status(201).json(created ? mapTask(created) : null);
  } catch (e) {
    res.status(statusFromError(e)).json({ error: messageFromError(e) });
  }
});

router.patch("/:taskId", requireAuth, async (req, res) => {
  try {
    const taskId = taskIdParam(req.params.taskId);
    if (!taskId) throw badRequest("Tarea inválida");
    const supabase = getUserSupabase(req as AuthedRequest);

    const current = await fetchTask(supabase, taskId);
    if (!current) {
      throw Object.assign(new Error("Tarea no encontrada"), { status: 404 });
    }

    const body = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if ("title" in body) {
      const title = readText(body.title, 150);
      if (!title) throw badRequest("El título es obligatorio");
      patch.titulo_tarea = title;
    }
    if ("description" in body) patch.descripcion_tarea = optionalText(body.description, 5000);
    if ("priority" in body) {
      const priority = String(body.priority ?? "").trim();
      if (!PRIORITIES.has(priority)) throw badRequest("Prioridad inválida");
      patch.prioridad_tarea = priority;
    }
    if ("status" in body) {
      const status = String(body.status ?? "").trim();
      if (!STATUSES.has(status)) throw badRequest("Estado inválido");
      patch.estado_tarea = status;
    }
    if ("deadline" in body) patch.fecha_limite = readDeadline(body.deadline);

    if (Object.keys(patch).length === 0) throw badRequest("Nada para actualizar");

    const { data, error } = await supabase
      .from("tareas_grupo")
      .update(patch)
      .eq("id_tarea", taskId)
      .select(TASK_SELECT)
      .maybeSingle();
    if (error) throw Object.assign(new Error(error.message), { status: 400 });
    if (!data) throw Object.assign(new Error("Tarea no encontrada o sin permiso"), { status: 404 });
    res.json(mapTask(data as TaskRow));
  } catch (e) {
    res.status(statusFromError(e)).json({ error: messageFromError(e) });
  }
});

router.delete("/:taskId", requireAuth, async (req, res) => {
  try {
    const taskId = taskIdParam(req.params.taskId);
    if (!taskId) throw badRequest("Tarea inválida");
    const supabase = getUserSupabase(req as AuthedRequest);
    const { data, error } = await supabase
      .from("tareas_grupo")
      .delete()
      .eq("id_tarea", taskId)
      .select("id_tarea")
      .maybeSingle();
    if (error) throw Object.assign(new Error(error.message), { status: 400 });
    if (!data) throw Object.assign(new Error("Tarea no encontrada o sin permiso"), { status: 404 });
    res.json({ deleted: String(taskId) });
  } catch (e) {
    res.status(statusFromError(e)).json({ error: messageFromError(e) });
  }
});

export default router;
