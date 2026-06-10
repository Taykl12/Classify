import { Router } from "express";
import { requireAuth, getUserSupabase } from "../middleware/auth.js";
import type { AuthedRequest } from "../middleware/auth.js";

function buildUserSearchLabel(
  dni: string | null | undefined,
  email: string,
  firstName: string,
  lastName: string
): string {
  const dniPart = dni?.trim() || "—";
  const namePart =
    [firstName, lastName].filter(Boolean).join(" ").trim() || "Sin nombre";
  return `${dniPart} - ${email} - ${namePart}`;
}

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
        dni: string | null;
      }) => {
        const firstName = row.nombre ?? "";
        const lastName = row.apellido ?? "";
        const dni = row.dni ?? "";
        return {
          id: row.id_usuario,
          email: row.email,
          firstName,
          lastName,
          dni,
          label: buildUserSearchLabel(dni, row.email, firstName, lastName),
        };
      }
    );
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

export default router;
