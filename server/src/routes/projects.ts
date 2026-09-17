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
import {
  getAssignedProfessorEmails,
  locksToDbPatch,
  mapProjectLocks,
  readLocksPayload,
} from "../lib/projectLocks.js";
import {
  getGroupMemberEmails,
  syncGroupMembers,
} from "../lib/projectMembers.js";
import { userIsProfessor } from "../lib/roles.js";
import { createAdminClient } from "../lib/supabase.js";
import {
  assertCanAccessGroup,
  assertIsProjectOwner,
  canManageProjectAccess,
  getAccessibleGroupIds,
  isProjectOwner,
  parseGroupId,
} from "../lib/projectAccess.js";

const router = Router();

function paramId(raw: string | string[]): string {
  return Array.isArray(raw) ? raw[0] : raw;
}

type ProjectDocumentBody = { name?: string; url?: string };

type ProjectLocksBody = {
  scope?: boolean;
  documentation?: boolean;
  team?: boolean;
};

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
  locks?: ProjectLocksBody;
};

type ProjectGradeBody = {
  grades?: Array<{ userId?: string; grade?: number | null }>;
};

interface ProjectMemberProfileRow {
  id_usuario: string;
  nombre: string | null;
  apellido: string | null;
  dni: string | null;
  foto_perfil: string | null;
  roles?: { nombre_rol: string } | { nombre_rol: string }[] | null;
}

interface ProjectGradeMemberDto {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  dni: string;
  profilePhotoUrl: string | null;
  grade: number | null;
}

/** Nombre del rol global (`usuarios.id_rol` → `roles.nombre_rol`), en minúsculas. */
function globalRoleName(roles: ProjectMemberProfileRow["roles"]): string {
  const raw = Array.isArray(roles) ? roles[0]?.nombre_rol : roles?.nombre_rol;
  return raw?.trim().toLowerCase() ?? "";
}

/**
 * Alumnos del proyecto + su nota final.
 *
 * - Usa el cliente service-role: `usuarios` y `grupo_estudiante` solo exponen la fila
 *   propia por RLS, así que un gestor no podría listar a los demás con el cliente del usuario.
 * - Solo incluye integrantes con rol global `alumno`: el creador del proyecto se agrega
 *   automáticamente a `grupo_estudiante`, y un profesor no debe figurar (ni calificarse a sí mismo).
 */
async function listProjectGradeMembers(idGrupo: number): Promise<ProjectGradeMemberDto[]> {
  const supabase = createAdminClient();

  const { data: assignments, error: assignError } = await supabase
    .from("grupo_estudiante")
    .select("id_usuario")
    .eq("id_grupo", idGrupo);
  if (assignError) throw new Error(assignError.message);

  const memberIds = (assignments ?? []).map((row) => row.id_usuario as string);
  if (memberIds.length === 0) return [];

  const [usersResult, gradesResult] = await Promise.all([
    supabase
      .from("usuarios")
      .select("id_usuario, nombre, apellido, dni, foto_perfil, roles(nombre_rol)")
      .in("id_usuario", memberIds),
    supabase
      .from("calificaciones_proyecto")
      .select("id_usuario, nota")
      .eq("id_grupo", idGrupo),
  ]);
  if (usersResult.error) throw new Error(usersResult.error.message);
  if (gradesResult.error) throw new Error(gradesResult.error.message);

  const gradesByUser = new Map<string, number | null>();
  const gradeRows = (gradesResult.data ?? []) as Array<{
    id_usuario: string;
    nota: number | string | null;
  }>;
  for (const row of gradeRows) {
    gradesByUser.set(
      row.id_usuario,
      row.nota === null || row.nota === undefined ? null : Number(row.nota)
    );
  }

  const usersById = new Map(
    ((usersResult.data ?? []) as ProjectMemberProfileRow[]).map((row) => [row.id_usuario, row])
  );

  return memberIds
    .map((id) => usersById.get(id))
    .filter((profile): profile is ProjectMemberProfileRow => globalRoleName(profile?.roles) === "alumno")
    .map((profile) => ({
      userId: profile.id_usuario,
      email: "",
      firstName: profile.nombre?.trim() ?? "",
      lastName: profile.apellido?.trim() ?? "",
      dni: profile.dni?.trim() ?? "",
      profilePhotoUrl: profile.foto_perfil ?? null,
      grade: gradesByUser.get(profile.id_usuario) ?? null,
    }))
    .sort((a, b) => {
      const nameA = `${a.lastName} ${a.firstName}`.trim().toLowerCase();
      const nameB = `${b.lastName} ${b.firstName}`.trim().toLowerCase();
      return nameA.localeCompare(nameB, "es");
    });
}

/** Puede calificar quien gestiona el proyecto y además es profesor o admin. */
async function canGradeProject(
  supabase: ReturnType<typeof getUserSupabase>,
  userId: string,
  idGrupo: number
): Promise<boolean> {
  const access = await canManageProjectAccess(supabase, userId, idGrupo);
  if (access.isAssigned || access.isAdmin) return true;
  return access.owns && (await userIsProfessor(supabase, userId));
}

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
    const docs: ProjectDocumentRow[] = body.documents.flatMap((d) => {
      const url = d.url?.trim();
      if (!url) return [];
      return [{ nombre: d.name?.trim() || url, url }];
    });
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

function assertSectionOpen(locked: boolean): void {
  if (locked) {
    throw Object.assign(new Error("Esta sección fue cerrada por el profesor"), { status: 403 });
  }
}

function hasScopeFields(body: ProjectBody): boolean {
  return (
    body.name !== undefined ||
    body.description !== undefined ||
    body.objective !== undefined ||
    body.scopeDetail !== undefined ||
    body.scopeNotes !== undefined ||
    body.status !== undefined
  );
}

function hasDocumentationFields(body: ProjectBody): boolean {
  return body.documents !== undefined || body.backupLink !== undefined || body.gradesLink !== undefined;
}

async function buildProjectDetailResponse(
  supabase: ReturnType<typeof getUserSupabase>,
  userId: string,
  idGrupo: number,
  grupo: GrupoProyectoRow
) {
  const [memberEmails, ownerEmail, access, assignedProfessorEmails] = await Promise.all([
    getGroupMemberEmails(supabase, idGrupo),
    getProjectOwnerEmail(supabase, idGrupo),
    canManageProjectAccess(supabase, userId, idGrupo),
    getAssignedProfessorEmails(supabase, idGrupo),
  ]);
  const locks = mapProjectLocks(grupo);
  return {
    ...mapProjectDetail(grupo),
    locks,
    memberEmails,
    ownerEmail,
    assignedProfessorEmails,
    isOwner: access.owns,
    isAssignedProfessor: access.isAssigned,
    canManageProject: access.canManage,
    canManageLocks: access.canManageLocks,
  };
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
    res.json(await buildProjectDetailResponse(supabase, userId, idGrupo, grupo as GrupoProyectoRow));
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

    const { data: currentRow, error: fetchCurrentError } = await supabase
      .from("grupos_proyectos")
      .select(GRUPO_PROJECT_SELECT)
      .eq("id_grupo", idGrupo)
      .single();
    if (fetchCurrentError || !currentRow) {
      res.status(404).json({ error: "Proyecto no encontrado" });
      return;
    }
    const current = currentRow as GrupoProyectoRow;
    const locks = mapProjectLocks(current);
    const access = await canManageProjectAccess(supabase, userId, idGrupo);
    const bypass = access.isAssigned || access.isAdmin;
    const locksBody = readLocksPayload(body);

    if (!access.canManage) {
      throw Object.assign(new Error("No tenés permiso para modificar este proyecto"), { status: 403 });
    }

    const patch: Record<string, unknown> = {};

    if (bypass) {
      Object.assign(patch, buildConfigPatch(body, { allowPreprojectApproval: true }));
      if (body.name !== undefined) patch.nombre_proyecto = body.name.trim();
      if (body.description !== undefined) patch.descripcion = body.description.trim() || null;
      if (body.status !== undefined) patch.estado_proyecto = body.status;
      Object.assign(patch, locksToDbPatch(locksBody));
    } else if (access.owns) {
      if (hasScopeFields(body)) assertSectionOpen(locks.scope);
      if (hasDocumentationFields(body)) assertSectionOpen(locks.documentation);
      if (body.memberEmails !== undefined) assertSectionOpen(locks.team);

      Object.assign(patch, buildConfigPatch(body, { allowPreprojectApproval: false }));
      if (body.name !== undefined) patch.nombre_proyecto = body.name.trim();
      if (body.description !== undefined) patch.descripcion = body.description.trim() || null;
      if (body.status !== undefined) patch.estado_proyecto = body.status;
    } else {
      throw Object.assign(new Error("No tenés permiso para modificar este proyecto"), { status: 403 });
    }

    if (body.memberEmails !== undefined) {
      if (!bypass && !access.owns) {
        throw Object.assign(new Error("Solo el creador puede editar integrantes"), { status: 403 });
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

    if (body.memberEmails !== undefined && (bypass || access.owns)) {
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
    res.json(await buildProjectDetailResponse(supabase, userId, idGrupo, grupo as GrupoProyectoRow));
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
    // El proyecto se borra ANTES del vínculo del dueño: la policy RLS de
    // grupos_proyectos exige `proyecto_profesor` para autorizar el DELETE.
    // Si no se borró ninguna fila el DELETE falló: hay que devolver error, no ok.
    const { data: borrados, error } = await supabase
      .from("grupos_proyectos")
      .delete()
      .in("id_grupo", toDelete)
      .select("id_grupo");
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    const deleted = (borrados ?? []).map((row) => String(row.id_grupo));
    if (deleted.length === 0) {
      res.status(403).json({ error: "No se pudieron eliminar los proyectos" });
      return;
    }
    // El vínculo cae por ON DELETE CASCADE; se limpia igual por si acaso.
    await supabase.from("proyecto_profesor").delete().eq("id_profesor", userId).in("id_grupo", toDelete);
    res.json({ deleted });
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
    // El proyecto se borra ANTES del vínculo del dueño: la policy RLS de
    // grupos_proyectos exige `proyecto_profesor` para autorizar el DELETE.
    // Si no se borró ninguna fila el DELETE falló (antes devolvía ok:true igual).
    const { data: borrados, error } = await supabase
      .from("grupos_proyectos")
      .delete()
      .eq("id_grupo", idGrupo)
      .select("id_grupo");
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (!borrados || borrados.length === 0) {
      res.status(403).json({ error: "No se pudo eliminar el proyecto" });
      return;
    }
    // El vínculo cae por ON DELETE CASCADE; se limpia igual por si acaso.
    await supabase.from("proyecto_profesor").delete().eq("id_profesor", userId).eq("id_grupo", idGrupo);
    res.json({ ok: true });
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 500;
    res.status(status).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

router.get("/:id/calificaciones", requireAuth, async (req, res) => {
  try {
    const { userId } = req as AuthedRequest;
    const idGrupo = parseGroupId(paramId(req.params.id));
    if (!idGrupo) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const supabase = getUserSupabase(req as AuthedRequest);
    await assertCanAccessGroup(supabase, userId, idGrupo);

    const canGrade = await canGradeProject(supabase, userId, idGrupo);
    const allMembers = await listProjectGradeMembers(idGrupo);
    // Un integrante que no gestiona el proyecto solo ve su propia nota.
    const members = canGrade
      ? allMembers
      : allMembers.filter((member) => member.userId === userId);

    res.json({ canGrade, members });
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 500;
    res.status(status).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

router.put("/:id/calificaciones", requireAuth, async (req, res) => {
  try {
    const { userId } = req as AuthedRequest;
    const idGrupo = parseGroupId(paramId(req.params.id));
    if (!idGrupo) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const body = req.body as ProjectGradeBody;
    if (!Array.isArray(body.grades)) {
      res.status(400).json({ error: "Datos de calificaciones inválidos" });
      return;
    }

    const supabase = getUserSupabase(req as AuthedRequest);
    await assertCanAccessGroup(supabase, userId, idGrupo);

    if (!(await canGradeProject(supabase, userId, idGrupo))) {
      res.status(403).json({ error: "Solo un profesor asignado o administrador puede calificar" });
      return;
    }

    const normalized: Array<{ userId: string; grade: number | null }> = [];
    for (const entry of body.grades) {
      const targetId = typeof entry.userId === "string" ? entry.userId.trim() : "";
      if (!targetId) {
        res.status(400).json({ error: "Datos de calificaciones inválidos" });
        return;
      }
      let grade: number | null = null;
      if (entry.grade !== null && entry.grade !== undefined) {
        if (
          typeof entry.grade !== "number" ||
          !Number.isFinite(entry.grade) ||
          entry.grade < 0 ||
          entry.grade > 10
        ) {
          res.status(400).json({ error: "Nota inválida" });
          return;
        }
        grade = Math.round(entry.grade * 100) / 100;
      }
      normalized.push({ userId: targetId, grade });
    }

    // Solo se puede calificar a integrantes con rol global `alumno` (el docente queda afuera).
    const members = await listProjectGradeMembers(idGrupo);
    const gradableIds = new Set(members.map((member) => member.userId));
    if (normalized.some((item) => !gradableIds.has(item.userId))) {
      res.status(400).json({ error: "El alumno no pertenece al proyecto" });
      return;
    }

    if (normalized.length > 0) {
      const admin = createAdminClient();
      const rows = normalized.map((item) => ({
        id_grupo: idGrupo,
        id_usuario: item.userId,
        nota: item.grade,
        id_calificado_por: userId,
        actualizado_en: new Date().toISOString(),
      }));
      const { error: upsertError } = await admin
        .from("calificaciones_proyecto")
        .upsert(rows, { onConflict: "id_grupo,id_usuario" });
      if (upsertError) throw new Error(upsertError.message);
    }

    // Reflejamos las notas recién guardadas sin volver a consultar.
    const gradesByUser = new Map(normalized.map((item) => [item.userId, item.grade]));
    res.json({
      canGrade: true,
      members: members.map((member) =>
        gradesByUser.has(member.userId)
          ? { ...member, grade: gradesByUser.get(member.userId) ?? null }
          : member
      ),
    });
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 500;
    res.status(status).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

export default router;
