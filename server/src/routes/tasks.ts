import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth, getUserSupabase } from "../middleware/auth.js";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const { userId } = req as AuthedRequest;
    const supabase = getUserSupabase(req as AuthedRequest);

    const { projectId, title, description, priority, deadline } = req.body;

    if (!projectId || !title) {
      res.status(400).json({ error: "projectId y title son requeridos" });
      return;
    }

    const { data, error } = await supabase.rpc("create_tarea_grupo", {
      p_id_grupo: Number(projectId),
      p_titulo: String(title).trim(),
      p_descripcion: description ? String(description).trim() : null,
      p_prioridad: priority ?? "Media",
      p_fecha_limite: deadline ? new Date(deadline).toISOString() : null,
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
