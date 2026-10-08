import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth, getUserSupabase } from "../middleware/auth.js";
import {
  mapFeaturedProject,
  mapPendingItem,
  type GrupoProyectoRow,
  type TareaGrupoRow,
} from "../lib/mappers.js";
import { getAccessibleGroupIds } from "../lib/projectAccess.js";
import { getFavoriteGroupIds } from "../lib/favorites.js";

const router = Router();

router.get("/featured", requireAuth, async (req, res) => {
  try {
    const { userId } = req as AuthedRequest;
    const supabase = getUserSupabase(req as AuthedRequest);
    const [ids, favoriteIds] = await Promise.all([
      getAccessibleGroupIds(supabase, userId),
      getFavoriteGroupIds(supabase, userId),
    ]);
    const accessible = new Set(ids);
    const favoriteAccessible = [...favoriteIds].filter((id) => accessible.has(id));
    if (favoriteAccessible.length === 0) {
      res.json([]);
      return;
    }
    const { data: grupos, error: gError } = await supabase
      .from("grupos_proyectos")
      .select("id_grupo, nombre_proyecto")
      .in("id_grupo", favoriteAccessible);
    if (gError) {
      res.status(500).json({ error: gError.message });
      return;
    }
    const { data: tareas, error: tError } = await supabase
      .from("tareas_grupo")
      .select("id_grupo, estado_tarea")
      .in("id_grupo", ids);
    if (tError) {
      res.status(500).json({ error: tError.message });
      return;
    }
    const counts = new Map<number, number>();
    for (const t of tareas ?? []) {
      if (t.estado_tarea === "Completado") continue;
      counts.set(t.id_grupo, (counts.get(t.id_grupo) ?? 0) + 1);
    }
    const featured = (grupos as GrupoProyectoRow[])
      .map((g) => mapFeaturedProject(g, counts.get(g.id_grupo) ?? 0))
      .sort((a, b) => b.pendingTasks - a.pendingTasks)
      .slice(0, 10);
    res.json(featured);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

router.get("/pending", requireAuth, async (req, res) => {
  try {
    const { userId } = req as AuthedRequest;
    const supabase = getUserSupabase(req as AuthedRequest);
    const ids = await getAccessibleGroupIds(supabase, userId);
    if (ids.length === 0) {
      res.json([]);
      return;
    }
    const { data, error } = await supabase
      .from("tareas_grupo")
      .select(
        "id_tarea, titulo_tarea, descripcion_tarea, prioridad_tarea, estado_tarea, id_grupo, grupos_proyectos(nombre_proyecto)"
      )
      .in("id_grupo", ids)
      .in("estado_tarea", ["Pendiente", "En Progreso"])
      .order("fecha_limite", { ascending: true, nullsFirst: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json((data ?? []).map((row) => mapPendingItem(row as TareaGrupoRow)));
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

export default router;
