import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth, getUserSupabase } from "../middleware/auth.js";
import { mapProjectListItem, type GrupoProyectoRow } from "../lib/mappers.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const { userId } = req as AuthedRequest;
    const supabase = getUserSupabase(req as AuthedRequest);
    const { data: links, error: linkError } = await supabase
      .from("proyecto_profesor")
      .select("id_grupo")
      .eq("id_profesor", userId);
    if (linkError) {
      res.status(500).json({ error: linkError.message });
      return;
    }
    const ids = (links ?? []).map((l) => l.id_grupo);
    if (ids.length === 0) {
      res.json([]);
      return;
    }
    const { data: grupos, error } = await supabase
      .from("grupos_proyectos")
      .select(
        "id_grupo, nombre_proyecto, descripcion, fecha_creacion, escuela, estado_proyecto"
      )
      .in("id_grupo", ids)
      .order("fecha_creacion", { ascending: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json((grupos as GrupoProyectoRow[]).map(mapProjectListItem));
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

export default router;
