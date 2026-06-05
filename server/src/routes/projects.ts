import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth, getUserSupabase } from "../middleware/auth.js";
import {
  GRUPO_PROJECT_SELECT,
  mapProjectDetail,
  mapProjectListItem,
  type GrupoProyectoRow,
  type ProjectDocumentRow,
} from "../lib/mappers.js";
import { getProjectOwnerEmail } from "../lib/projectOwner.js";
import { userIsProfessor } from "../lib/roles.js";
import {
  getGroupMemberEmails,
  syncGroupMembers,
} from "../lib/projectMembers.js";
import {
  assertCanAccessGroup,
  assertIsProjectOwner,
  getAccessibleGroupIds,
  isProjectOwner,
  parseGroupId,
} from "../lib/projectAccess.js";

const router = Router();

function paramId(raw: string | string[]): string {
  return Array.isArray(raw) ? raw[0] : raw;
}

type ProjectDocumentBody = { name?: string; url?: string };

type ProjectBody = {
  name?: string;
  description?: string;
  memberEmails?: string[];
  status?: "Abierto" | "Cerrado";
  objective?: string;
  scopeDetail?: string;
  scopeNotes?: string;
  preprojectValidated?: boolean;
  backupLink?: string;
  gradesLink?: string;
  documents?: ProjectDocumentBody[];
};

function buildConfigPatch(
  body: ProjectBody,
  options?: { allowPreprojectApproval?: boolean }
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (body.objective !== undefined) patch.descripcion = body.objective.trim() || null;
  if (body.scopeDetail !== undefined) patch.alcance_detalle = body.scopeDetail.trim() || null;
  if (body.scopeNotes !== undefined) patch.notas_alcance = body.scopeNotes.trim() || null;
  if (body.preprojectValidated !== undefined && options?.allowPreprojectApproval) {
    patch.anteproyecto_validado = body.preprojectValidated;
  }
  if (body.backupLink !== undefined) patch.link_respaldo = body.backupLink.trim() || null;
  if (body.gradesLink !== undefined) patch.link_calificaciones = body.gradesLink.trim() || null;
  if (body.documents !== undefined) {
    const docs: ProjectDocumentRow[] = body.documents
      .filter((d) => d.url?.trim())
      .map((d) => ({
        nombre: d.name?.trim() || d.url!.trim(),
        url: d.url!.trim(),
      }));
    patch.documentos = docs;
  }
  return patch;
}

function validateProjectBody(body: ProjectBody, partial = false): string | null {
  if (!partial && !body.name?.trim()) {
    return "El nombre del proyecto es obligatorio";
  }
  if (body.name !== undefined && !body.name.trim()) return "El nombre es obligatorio";
  if (body.status && body.status !== "Abierto" && body.status !== "Cerrado") {
    return "Estado inválido";
  }
  return null;
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const { userId } = req as AuthedRequest;
    const supabase = getUserSupabase(req as AuthedRequest);
    const ids = await getAccessibleGroupIds(supabase, userId);
    if (ids.length === 0) {
      res.json([]);
      return;
    }
    const { data: grupos, error } = await supabase
      .from("grupos_proyectos")
      .select(GRUPO_PROJECT_SELECT)
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

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { userId } = req as AuthedRequest;
    const idGrupo = parseGroupId(paramId(req.params.id));
    if (!idGrupo) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const supabase = getUserSupabase(req as AuthedRequest);
    await assertCanAccessGroup(supabase, userId, idGrupo);
    const { data: grupo, error } = await supabase
      .from("grupos_proyectos")
      .select(GRUPO_PROJECT_SELECT)
      .eq("id_grupo", idGrupo)
      .single();
    if (error || !grupo) {
      res.status(404).json({ error: "Proyecto no encontrado" });
      return;
    }
    const [memberEmails, ownerEmail, owns] = await Promise.all([
      getGroupMemberEmails(supabase, idGrupo),
      getProjectOwnerEmail(supabase, idGrupo),
      isProjectOwner(supabase, userId, idGrupo),
    ]);
    res.json({
      ...mapProjectDetail(grupo as GrupoProyectoRow),
      memberEmails,
      ownerEmail,
      isOwner: owns,
    });
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 500;
    res.status(status).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const { userId } = req as AuthedRequest;
    const body = req.body as ProjectBody;
    const validation = validateProjectBody(body);
    if (validation) {
      res.status(400).json({ error: validation });
      return;
    }
    const supabase = getUserSupabase(req as AuthedRequest);
    const { data: grupoJson, error: insertError } = await supabase.rpc(
      "create_grupo_proyecto",
      {
        p_nombre: body.name!.trim(),
        p_descripcion: body.description?.trim() || null,
      }
    );
    if (insertError || !grupoJson) {
      res.status(400).json({ error: insertError?.message ?? "No se pudo crear el proyecto" });
      return;
    }
    const grupo = grupoJson as GrupoProyectoRow;
    const { notFound } = await syncGroupMembers(
      supabase,
      grupo.id_grupo as number,
      body.memberEmails ?? []
    );
    if (notFound.length > 0) {
      res.status(400).json({
        error: `No hay cuenta registrada para: ${notFound.join(", ")}`,
      });
      return;
    }
    const memberEmails = await getGroupMemberEmails(supabase, grupo.id_grupo as number);
    res.status(201).json({ ...mapProjectListItem(grupo as GrupoProyectoRow), memberEmails });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { userId } = req as AuthedRequest;
    const idGrupo = parseGroupId(paramId(req.params.id));
    if (!idGrupo) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const body = req.body as ProjectBody;
    const validation = validateProjectBody(body, true);
    if (validation) {
      res.status(400).json({ error: validation });
      return;
    }
    const supabase = getUserSupabase(req as AuthedRequest);
    await assertCanAccessGroup(supabase, userId, idGrupo);
    const [owns, isProf] = await Promise.all([
      isProjectOwner(supabase, userId, idGrupo),
      userIsProfessor(supabase, userId),
    ]);

    const patch: Record<string, unknown> = {};
    if (owns) {
      Object.assign(patch, buildConfigPatch(body, { allowPreprojectApproval: isProf }));
      if (body.name !== undefined) patch.nombre_proyecto = body.name.trim();
      if (body.description !== undefined) patch.descripcion = body.description.trim() || null;
      if (body.status !== undefined) patch.estado_proyecto = body.status;
    } else if (isProf && body.preprojectValidated !== undefined) {
      patch.anteproyecto_validado = body.preprojectValidated;
    } else {
      const err = new Error("No tenés permiso para modificar este proyecto");
      (err as Error & { status: number }).status = 403;
      throw err;
    }

    if (body.memberEmails !== undefined) {
      if (!owns) {
        const err = new Error("Solo el creador puede editar integrantes");
        (err as Error & { status: number }).status = 403;
        throw err;
      }
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from("grupos_proyectos")
        .update(patch)
        .eq("id_grupo", idGrupo);
      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }
    }

    if (body.memberEmails !== undefined) {
      const { notFound } = await syncGroupMembers(supabase, idGrupo, body.memberEmails);
      if (notFound.length > 0) {
        res.status(400).json({
          error: `No hay cuenta registrada para: ${notFound.join(", ")}`,
        });
        return;
      }
    }

    const { data: grupo, error: fetchError } = await supabase
      .from("grupos_proyectos")
      .select(GRUPO_PROJECT_SELECT)
      .eq("id_grupo", idGrupo)
      .single();
    if (fetchError || !grupo) {
      res.status(404).json({ error: "Proyecto no encontrado" });
      return;
    }
    const [memberEmails, ownerEmail] = await Promise.all([
      getGroupMemberEmails(supabase, idGrupo),
      getProjectOwnerEmail(supabase, idGrupo),
    ]);
    res.json({
      ...mapProjectDetail(grupo as GrupoProyectoRow),
      memberEmails,
      ownerEmail,
      isOwner: owns,
    });
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 500;
    res.status(status).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

router.patch("/:id/favorite", requireAuth, async (req, res) => {
  try {
    const { userId } = req as AuthedRequest;
    const idGrupo = parseGroupId(paramId(req.params.id));
    if (!idGrupo) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const { isFavorite } = req.body as { isFavorite?: boolean };
    if (typeof isFavorite !== "boolean") {
      res.status(400).json({ error: "isFavorite debe ser booleano" });
      return;
    }
    const supabase = getUserSupabase(req as AuthedRequest);
    await assertIsProjectOwner(supabase, userId, idGrupo);

    const { data: grupo, error } = await supabase
      .from("grupos_proyectos")
      .update({ es_favorito: isFavorite })
      .eq("id_grupo", idGrupo)
      .select(GRUPO_PROJECT_SELECT)
      .single();
    if (error || !grupo) {
      res.status(400).json({ error: error?.message ?? "No se pudo actualizar favorito" });
      return;
    }
    res.json(mapProjectListItem(grupo as GrupoProyectoRow));
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 500;
    res.status(status).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

router.delete("/bulk", requireAuth, async (req, res) => {
  try {
    const { userId } = req as AuthedRequest;
    const { ids } = req.body as { ids?: string[] };
    if (!ids?.length) {
      res.status(400).json({ error: "Seleccioná al menos un proyecto" });
      return;
    }
    const idGrupos = ids.map(parseGroupId).filter((n): n is number => n !== null);
    if (idGrupos.length === 0) {
      res.status(400).json({ error: "IDs inválidos" });
      return;
    }
    const supabase = getUserSupabase(req as AuthedRequest);
    const { data: ownerLinks } = await supabase
      .from("proyecto_profesor")
      .select("id_grupo")
      .eq("id_profesor", userId)
      .in("id_grupo", idGrupos);
    const toDelete = (ownerLinks ?? []).map((r) => r.id_grupo as number);
    if (toDelete.length === 0) {
      res.status(404).json({ error: "No se encontraron proyectos" });
      return;
    }
    await supabase.from("grupo_estudiante").delete().in("id_grupo", toDelete);
    await supabase.from("proyecto_profesor").delete().eq("id_profesor", userId).in("id_grupo", toDelete);
    const { error } = await supabase.from("grupos_proyectos").delete().in("id_grupo", toDelete);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ deleted: toDelete.map(String) });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { userId } = req as AuthedRequest;
    const idGrupo = parseGroupId(paramId(req.params.id));
    if (!idGrupo) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const supabase = getUserSupabase(req as AuthedRequest);
    await assertIsProjectOwner(supabase, userId, idGrupo);
    await supabase.from("grupo_estudiante").delete().eq("id_grupo", idGrupo);
    await supabase.from("proyecto_profesor").delete().eq("id_profesor", userId).eq("id_grupo", idGrupo);
    const { error } = await supabase.from("grupos_proyectos").delete().eq("id_grupo", idGrupo);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 500;
    res.status(status).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

export default router;
