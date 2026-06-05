import { Router } from "express";
import { requireAuth, getUserSupabase } from "../middleware/auth.js";
import type { AuthedRequest } from "../middleware/auth.js";

const router = Router();

router.get("/search", requireAuth, async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 1) {
      res.json([]);
      return;
    }
    const supabase = getUserSupabase(req as AuthedRequest);
    const { data, error } = await supabase.rpc("search_usuarios_for_invite", {
      p_query: q,
    });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    const results = (data ?? []).map(
      (row: {
        id_usuario: string;
        email: string;
        nombre: string | null;
        apellido: string | null;
      }) => ({
        id: row.id_usuario,
        email: row.email,
        firstName: row.nombre ?? "",
        lastName: row.apellido ?? "",
        label: `${row.email} - ${[row.nombre, row.apellido].filter(Boolean).join(" ") || "Sin nombre"}`,
      })
    );
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

export default router;
