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
  type: "task" | "delivery";
  priority?: string;
  status?: string;
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

    const { data: tareas, error: tError } = await supabase
      .from("tareas_grupo")
      .select(
        "id_tarea, titulo_tarea, descripcion_tarea, fecha_limite, prioridad_tarea, estado_tarea, id_grupo, grupos_proyectos(nombre_proyecto)"
      )
      .in("id_grupo", ids)
      .not("fecha_limite", "is", null)
      .order("fecha_limite", { ascending: true });

    if (tError) {
      res.status(500).json({ error: tError.message });
      return;
    }

    const events: CalendarEventRow[] = (tareas ?? []).map((row: Record<string, unknown>) => {
      const gp = row.grupos_proyectos as { nombre_proyecto?: string } | { nombre_proyecto?: string }[] | null;
      const projectName = Array.isArray(gp)
        ? (gp[0]?.nombre_proyecto ?? "Proyecto")
        : (gp?.nombre_proyecto ?? "Proyecto");
      return {
        id: String(row.id_tarea),
        title: (row.titulo_tarea as string)?.trim() || "Tarea sin título",
        description: (row.descripcion_tarea as string) ?? null,
        date: row.fecha_limite as string,
        projectName,
        projectId: String(row.id_grupo),
        type: "task",
        priority: row.prioridad_tarea as string,
        status: row.estado_tarea as string,
      };
    });

    res.json(events);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

export default router;
