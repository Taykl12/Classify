import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth, getUserSupabase } from "../middleware/auth.js";
import { getAccessibleGroupIds } from "../lib/projectAccess.js";

const router = Router();

interface CalendarEventRow {
  id: string;
  title: string;
  description: string | null;
  date: string;
  projectName: string;
  projectId: string;
  type: "event";
  priority?: string;
}

function mapEventRow(row: Record<string, unknown>): CalendarEventRow {
  const gp = row.grupos_proyectos as { nombre_proyecto?: string } | { nombre_proyecto?: string }[] | null;
  const projectName = Array.isArray(gp)
    ? (gp[0]?.nombre_proyecto ?? "Proyecto")
    : (gp?.nombre_proyecto ?? "Proyecto");

  return {
    id: String(row.id_evento),
    title: (row.titulo_evento as string)?.trim() || "Evento sin título",
    description: (row.descripcion_evento as string) ?? null,
    date: String(row.fecha_evento).split("T")[0] ?? String(row.fecha_evento),
    projectName,
    projectId: String(row.id_grupo),
    type: "event",
    priority: row.prioridad_evento as string,
  };
}

router.get("/events", requireAuth, async (req, res) => {
  try {
    const { userId } = req as AuthedRequest;
    const supabase = getUserSupabase(req as AuthedRequest);
    const ids = await getAccessibleGroupIds(supabase, userId);
    if (ids.length === 0) {
      res.json([]);
      return;
    }

    const { data: eventos, error: eError } = await supabase
      .from("eventos_calendario")
      .select(
        "id_evento, titulo_evento, descripcion_evento, fecha_evento, prioridad_evento, id_grupo, grupos_proyectos(nombre_proyecto)"
      )
      .in("id_grupo", ids)
      .order("fecha_evento", { ascending: true });

    if (eError) {
      res.status(500).json({ error: eError.message });
      return;
    }

    const events: CalendarEventRow[] = (eventos ?? []).map(mapEventRow);
    res.json(events);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

router.post("/events", requireAuth, async (req, res) => {
  try {
    const { projectId, title, description, priority, eventDate } = req.body;

    if (!projectId || !title?.trim()) {
      res.status(400).json({ error: "projectId y title son obligatorios" });
      return;
    }

    if (!eventDate) {
      res.status(400).json({ error: "eventDate es obligatorio" });
      return;
    }

    const supabase = getUserSupabase(req as AuthedRequest);
    const { data, error } = await supabase.rpc("create_evento_calendario", {
      p_id_grupo: Number(projectId),
      p_titulo: String(title).trim(),
      p_fecha_evento: String(eventDate),
      p_descripcion: description ? String(description).trim() : null,
      p_prioridad: priority ?? "Media",
    });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

export default router;
