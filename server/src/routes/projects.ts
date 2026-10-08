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
import { userIsAdmin, userIsProfessor } from "../lib/roles.js";
import { getFavoriteGroupIds, isFavoriteProyecto } from "../lib/favorites.js";
import { optionalHttpUrl, optionalText, readHttpUrl, readText } from "../lib/validation.js";
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
  grades: ProjectGradeEntryDto[];
  average: number | null;
}

interface ProjectGradeEntryDto {
  id: string;
  nota: number | null;
  descripcion: string;
  fecha: string;
}

interface GradeEntryRow {
  id_calificacion: number;
  id_usuario: string;
  nota: number | string | null;
  descripcion: string | null;
  fecha: string;
}

const MAX_GRADE_TEXT = 500;

function computeAverage(grades: ProjectGradeEntryDto[]): number | null {
  const values = grades
    .map((grade) => grade.nota)
    .filter((nota): nota is number => nota !== null);
  if (values.length === 0) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  return Math.round((sum / values.length) * 100) / 100;
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
      .select("id_calificacion, id_usuario, nota, descripcion, fecha")
      .eq("id_grupo", idGrupo)
      .order("fecha", { ascending: false })
      .order("id_calificacion", { ascending: false }),
  ]);
  if (usersResult.error) throw new Error(usersResult.error.message);
  if (gradesResult.error) throw new Error(gradesResult.error.message);

  const gradesByUser = new Map<string, ProjectGradeEntryDto[]>();
  for (const row of (gradesResult.data ?? []) as GradeEntryRow[]) {
    const list = gradesByUser.get(row.id_usuario) ?? [];
    list.push({
      id: String(row.id_calificacion),
      nota:
        row.nota === null || row.nota === undefined ? null : Number(row.nota),
      descripcion: (row.descripcion ?? "").trim(),
      fecha: String(row.fecha).split("T")[0] ?? String(row.fecha),
    });
    gradesByUser.set(row.id_usuario, list);
  }

  const usersById = new Map(
    ((usersResult.data ?? []) as ProjectMemberProfileRow[]).map((row) => [row.id_usuario, row])
  );

  return memberIds
    .map((id) => usersById.get(id))
    .filter((profile): profile is ProjectMemberProfileRow => globalRoleName(profile?.roles) === "alumno")
    .map((profile) => {
      const grades = gradesByUser.get(profile.id_usuario) ?? [];
      return {
        userId: profile.id_usuario,
        email: "",
        firstName: profile.nombre?.trim() ?? "",
        lastName: profile.apellido?.trim() ?? "",
        dni: profile.dni?.trim() ?? "",
        profilePhotoUrl: profile.foto_perfil ?? null,
        grades,
        average: computeAverage(grades),
      };
    })
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
  if (body.objective !== undefined) patch.descripcion = readText(body.objective, 2000) || null;
  if (body.scopeDetail !== undefined) patch.alcance_detalle = readText(body.scopeDetail, 5000) || null;
  if (body.scopeNotes !== undefined) patch.notas_alcance = readText(body.scopeNotes, 2000) || null;
  if (body.preprojectValidated !== undefined && options?.allowPreprojectApproval) {
    patch.anteproyecto_validado = body.preprojectValidated;
  }
  if (body.backupLink !== undefined) {
    patch.link_respaldo = optionalHttpUrl(body.backupLink, "Enlace de respaldo");
  }
  if (body.gradesLink !== undefined) {
    patch.link_calificaciones = optionalHttpUrl(body.gradesLink, "Enlace de calificaciones");
  }
  if (body.documents !== undefined) {
    const docs: ProjectDocumentRow[] = body.documents.flatMap((d) => {
      const url = readText(d.url, 2000);
      if (!url) return [];
      const safeUrl = readHttpUrl(url, "Documento");
      const name = readText(d.name, 200) || safeUrl;
      return [{ nombre: name, url: safeUrl }];
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
  if (body.name !== undefined && body.name.trim().length > 150) {
    return "El nombre no puede superar 150 caracteres";
  }
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
  grupo: GrupoProyectoRow,
  isFavorite: boolean
) {
  const [memberEmails, ownerEmail, access, assignedProfessorEmails] = await Promise.all([
    getGroupMemberEmails(supabase, idGrupo),
    getProjectOwnerEmail(supabase, idGrupo),
    canManageProjectAccess(supabase, userId, idGrupo),
    getAssignedProfessorEmails(supabase, idGrupo),
  ]);
  const locks = mapProjectLocks(grupo);
  return {
    ...mapProjectDetail(grupo, isFavorite),
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
    const scopeAll = String(req.query.scope ?? "").trim().toLowerCase() === "all";

    const [ids, favoriteIds] = await Promise.all([
      getAccessibleGroupIds(supabase, userId),
      getFavoriteGroupIds(supabase, userId),
    ]);

    // `scope=all` solo tiene efecto para administradores (listado global).
    const wantsAll = scopeAll && (await userIsAdmin(supabase, userId));

    let query = supabase
      .from("grupos_proyectos")
      .select(GRUPO_PROJECT_SELECT)
      .order("fecha_creacion", { ascending: false });

    if (!wantsAll) {
      if (ids.length === 0) {
        res.json([]);
        return;
      }
      query = query.in("id_grupo", ids);
    }

    const { data: grupos, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(
      (grupos as GrupoProyectoRow[]).map((row) =>
        mapProjectListItem(row, favoriteIds.has(row.id_grupo))
      )
    );
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
    const isFavorite = await isFavoriteProyecto(supabase, userId, idGrupo);
    res.json(
      await buildProjectDetailResponse(
        supabase,
        userId,
        idGrupo,
        grupo as GrupoProyectoRow,
        isFavorite
      )
    );
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
    res.status(201).json({ ...mapProjectListItem(grupo as GrupoProyectoRow, false), memberEmails });
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
    const isFavorite = await isFavoriteProyecto(supabase, userId, idGrupo);
    res.json(
      await buildProjectDetailResponse(
        supabase,
        userId,
        idGrupo,
        grupo as GrupoProyectoRow,
        isFavorite
      )
    );
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
    // Favorito personal: cualquier usuario con acceso puede marcarlo/quitar.
    await assertCanAccessGroup(supabase, userId, idGrupo);

    if (isFavorite) {
      const { error } = await supabase
        .from("proyecto_favorito")
        .insert({ id_grupo: idGrupo, id_usuario: userId });
      // 23505 = ya estaba marcado: idempotente.
      if (error && error.code !== "23505") throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("proyecto_favorito")
        .delete()
        .eq("id_usuario", userId)
        .eq("id_grupo", idGrupo);
      if (error) throw new Error(error.message);
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
    res.json(mapProjectListItem(grupo as GrupoProyectoRow, isFavorite));
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

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function readGradeNota(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10) {
    throw Object.assign(new Error("Nota inválida (0–10)"), { status: 400 });
  }
  return Math.round(parsed * 100) / 100;
}

function readGradeDate(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return todayIso();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw Object.assign(new Error("Fecha inválida (YYYY-MM-DD)"), { status: 400 });
  }
  return raw;
}

async function assertCanGradeProject(
  supabase: ReturnType<typeof getUserSupabase>,
  userId: string,
  idGrupo: number
): Promise<void> {
  if (await canGradeProject(supabase, userId, idGrupo)) return;
  throw Object.assign(
    new Error("Solo un profesor asignado o administrador puede calificar"),
    { status: 403 }
  );
}

/** Agrega una nota diaria a un integrante. */
router.post("/:id/calificaciones", requireAuth, async (req, res) => {
  try {
    const { userId } = req as AuthedRequest;
    const idGrupo = parseGroupId(paramId(req.params.id));
    if (!idGrupo) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const targetId = typeof body.userId === "string" ? body.userId.trim() : "";
    if (!targetId) {
      res.status(400).json({ error: "Alumno requerido" });
      return;
    }
    const nota = readGradeNota(body.nota);
    if (nota === null) {
      res.status(400).json({ error: "Ingresá una nota" });
      return;
    }
    const descripcion = optionalText(body.descripcion, MAX_GRADE_TEXT);
    const fecha = readGradeDate(body.fecha);

    const supabase = getUserSupabase(req as AuthedRequest);
    await assertCanAccessGroup(supabase, userId, idGrupo);
    await assertCanGradeProject(supabase, userId, idGrupo);

    const members = await listProjectGradeMembers(idGrupo);
    if (!members.some((member) => member.userId === targetId)) {
      res.status(400).json({ error: "El alumno no pertenece al proyecto" });
      return;
    }

    const admin = createAdminClient();
    const { error } = await admin.from("calificaciones_proyecto").insert({
      id_grupo: idGrupo,
      id_usuario: targetId,
      nota,
      descripcion,
      fecha,
      id_calificado_por: userId,
      actualizado_en: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);

    res.status(201).json({ canGrade: true, members: await listProjectGradeMembers(idGrupo) });
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 500;
    res.status(status).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

/** Edita una nota diaria. */
router.patch("/:id/calificaciones/:gradeId", requireAuth, async (req, res) => {
  try {
    const { userId } = req as AuthedRequest;
    const idGrupo = parseGroupId(paramId(req.params.id));
    const gradeId = Number(paramId(req.params.gradeId));
    if (!idGrupo || !Number.isInteger(gradeId) || gradeId <= 0) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if ("nota" in body) patch.nota = readGradeNota(body.nota);
    if ("descripcion" in body) patch.descripcion = optionalText(body.descripcion, MAX_GRADE_TEXT);
    if ("fecha" in body) patch.fecha = readGradeDate(body.fecha);
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "Nada para actualizar" });
      return;
    }
    patch.id_calificado_por = userId;
    patch.actualizado_en = new Date().toISOString();

    const supabase = getUserSupabase(req as AuthedRequest);
    await assertCanAccessGroup(supabase, userId, idGrupo);
    await assertCanGradeProject(supabase, userId, idGrupo);

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("calificaciones_proyecto")
      .update(patch)
      .eq("id_calificacion", gradeId)
      .eq("id_grupo", idGrupo)
      .select("id_calificacion")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      res.status(404).json({ error: "Nota no encontrada" });
      return;
    }

    res.json({ canGrade: true, members: await listProjectGradeMembers(idGrupo) });
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 500;
    res.status(status).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

/** Elimina una nota diaria. */
router.delete("/:id/calificaciones/:gradeId", requireAuth, async (req, res) => {
  try {
    const { userId } = req as AuthedRequest;
    const idGrupo = parseGroupId(paramId(req.params.id));
    const gradeId = Number(paramId(req.params.gradeId));
    if (!idGrupo || !Number.isInteger(gradeId) || gradeId <= 0) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const supabase = getUserSupabase(req as AuthedRequest);
    await assertCanAccessGroup(supabase, userId, idGrupo);
    await assertCanGradeProject(supabase, userId, idGrupo);

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("calificaciones_proyecto")
      .delete()
      .eq("id_calificacion", gradeId)
      .eq("id_grupo", idGrupo)
      .select("id_calificacion")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      res.status(404).json({ error: "Nota no encontrada" });
      return;
    }

    res.json({ canGrade: true, members: await listProjectGradeMembers(idGrupo) });
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 500;
    res.status(status).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

export default router;
