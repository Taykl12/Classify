import { Router } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "../lib/supabase.js";
import {
  GRUPO_PROJECT_SELECT,
  mapProjectDetail,
  type GrupoProyectoRow,
} from "../lib/mappers.js";
import {
  getAssignedProfessorIds,
  getAssignedProfessorIdsByGroups,
  locksToDbPatch,
  mapProjectLocks,
  type ProjectLocksBody,
} from "../lib/projectLocks.js";
import { getProjectOwnerEmail } from "../lib/projectOwner.js";
import { getGroupMemberEmails, syncGroupMembers } from "../lib/projectMembers.js";
import { parseGroupId } from "../lib/projectAccess.js";
import { requireAdmin } from "../middleware/admin.js";
import { requireAuth } from "../middleware/auth.js";

interface AdminProjectListItem {
  id: string;
  name: string;
  status: "Abierto" | "Cerrado";
  ownerEmail: string | null;
  assignedProfessorIds: string[];
  memberCount: number;
  locks: { scope: boolean; documentation: boolean; team: boolean };
  createdAt: string;
}

interface AdminProjectDetail extends AdminProjectListItem {
  description: string;
  objective: string;
  scopeDetail: string;
  scopeNotes: string;
  preprojectValidated: boolean;
  backupLink: string;
  documents: { name: string; url: string }[];
  memberEmails: string[];
}

function paramId(raw: string | string[]): string {
  return Array.isArray(raw) ? raw[0] : raw;
}

function toTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseIdParam(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function statusFromError(e: unknown): number {
  return typeof e === "object" && e !== null && "status" in e
    ? Number((e as { status: unknown }).status) || 500
    : 500;
}

function messageFromError(e: unknown): string {
  return e instanceof Error ? e.message : "Error interno";
}

function readIdArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw Object.assign(new Error(`${label} debe ser una lista`), { status: 400 });
  }
  return [...new Set(value.map((item) => toTrimmedString(item)).filter(Boolean))];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function mapAdminListItem(
  row: GrupoProyectoRow,
  ownerEmail: string | null,
  assignedProfessorIds: string[],
  memberCount: number
): AdminProjectListItem {
  const status = (row.estado_proyecto ?? "Abierto") as "Abierto" | "Cerrado";
  return {
    id: String(row.id_grupo),
    name: row.nombre_proyecto,
    status: status === "Cerrado" ? "Cerrado" : "Abierto",
    ownerEmail,
    assignedProfessorIds,
    memberCount,
    locks: mapProjectLocks(row),
    createdAt: formatDate(row.fecha_creacion),
  };
}

async function assertProfessorIds(
  supabase: SupabaseClient,
  professorIds: string[]
): Promise<void> {
  if (professorIds.length === 0) return;
  const { data, error } = await supabase
    .from("usuarios")
    .select("id_usuario, roles(nombre_rol)")
    .in("id_usuario", professorIds);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length !== professorIds.length) {
    throw Object.assign(new Error("Uno o más profesores no existen"), { status: 400 });
  }
  for (const row of rows) {
    const roles = row.roles as { nombre_rol: string } | { nombre_rol: string }[] | null;
    const raw = Array.isArray(roles) ? roles[0]?.nombre_rol : roles?.nombre_rol;
    if (raw?.trim().toLowerCase() !== "profesor") {
      throw Object.assign(new Error("Solo se pueden asignar usuarios con rol profesor"), {
        status: 400,
      });
    }
  }
}

async function getMemberCounts(
  supabase: SupabaseClient,
  groupIds: number[]
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (groupIds.length === 0) return map;
  const { data, error } = await supabase
    .from("grupo_estudiante")
    .select("id_grupo")
    .in("id_grupo", groupIds);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const id = row.id_grupo as number;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

async function buildAdminDetail(
  supabase: SupabaseClient,
  row: GrupoProyectoRow
): Promise<AdminProjectDetail> {
  const idGrupo = row.id_grupo;
  const [ownerEmail, assignedProfessorIds, memberEmails] = await Promise.all([
    getProjectOwnerEmail(supabase, idGrupo),
    getAssignedProfessorIds(supabase, idGrupo),
    getGroupMemberEmails(supabase, idGrupo),
  ]);
  const detail = mapProjectDetail(row);
  return {
    ...mapAdminListItem(row, ownerEmail, assignedProfessorIds, memberEmails.length),
    description: detail.description,
    objective: detail.objective,
    scopeDetail: detail.scopeDetail,
    scopeNotes: detail.scopeNotes,
    preprojectValidated: detail.preprojectValidated,
    backupLink: detail.backupLink,
    documents: detail.documents,
    memberEmails,
  };
}

async function deleteProjectCascade(supabase: SupabaseClient, idGrupo: number): Promise<void> {
  await supabase.from("grupo_estudiante").delete().eq("id_grupo", idGrupo);
  await supabase.from("proyecto_profesor_asignado").delete().eq("id_grupo", idGrupo);
  await supabase.from("proyecto_profesor").delete().eq("id_grupo", idGrupo);
  await supabase.from("proyecto_materia").delete().eq("id_grupo", idGrupo);
  const { error } = await supabase.from("grupos_proyectos").delete().eq("id_grupo", idGrupo);
  if (error) {
    throw Object.assign(new Error(error.message), { status: 400 });
  }
}

type AdminProjectBody = {
  name?: string;
  status?: "Abierto" | "Cerrado";
  objective?: string;
  scopeDetail?: string;
  scopeNotes?: string;
  preprojectValidated?: boolean;
  backupLink?: string;
  documents?: { name?: string; url?: string }[];
  memberEmails?: string[];
};

function readProjectUpdatePayload(body: unknown): AdminProjectBody {
  const raw = body as Record<string, unknown>;
  const status = raw.status;
  if (status !== undefined && status !== "Abierto" && status !== "Cerrado") {
    throw Object.assign(new Error("Estado inválido"), { status: 400 });
  }
  return {
    name: raw.name !== undefined ? toTrimmedString(raw.name) : undefined,
    status: status as "Abierto" | "Cerrado" | undefined,
    objective: raw.objective !== undefined ? toTrimmedString(raw.objective) : undefined,
    scopeDetail: raw.scopeDetail !== undefined ? toTrimmedString(raw.scopeDetail) : undefined,
    scopeNotes: raw.scopeNotes !== undefined ? toTrimmedString(raw.scopeNotes) : undefined,
    preprojectValidated:
      typeof raw.preprojectValidated === "boolean" ? raw.preprojectValidated : undefined,
    backupLink: raw.backupLink !== undefined ? toTrimmedString(raw.backupLink) : undefined,
    documents: Array.isArray(raw.documents)
      ? (raw.documents as { name?: string; url?: string }[])
      : undefined,
    memberEmails: Array.isArray(raw.memberEmails)
      ? raw.memberEmails.map((e) => toTrimmedString(e)).filter(Boolean)
      : undefined,
  };
}

function readLocksOnlyPayload(body: unknown): ProjectLocksBody {
  const raw = body as Record<string, unknown>;
  return {
    scope: typeof raw.scope === "boolean" ? raw.scope : undefined,
    documentation: typeof raw.documentation === "boolean" ? raw.documentation : undefined,
    team: typeof raw.team === "boolean" ? raw.team : undefined,
  };
}

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/", async (_req, res) => {
  try {
    const supabase = createAdminClient();
    const { data: rows, error } = await supabase
      .from("grupos_proyectos")
      .select(GRUPO_PROJECT_SELECT)
      .order("fecha_creacion", { ascending: false });
    if (error) throw new Error(error.message);
    const projects = (rows ?? []) as GrupoProyectoRow[];
    const ids = projects.map((p) => p.id_grupo);
    const [assignments, memberCounts] = await Promise.all([
      getAssignedProfessorIdsByGroups(supabase, ids),
      getMemberCounts(supabase, ids),
    ]);
    const ownerEmails = await Promise.all(
      projects.map((p) => getProjectOwnerEmail(supabase, p.id_grupo))
    );
    res.json({
      projects: projects.map((row, index) =>
        mapAdminListItem(
          row,
          ownerEmails[index] ?? null,
          assignments.get(row.id_grupo) ?? [],
          memberCounts.get(row.id_grupo) ?? 0
        )
      ),
    });
  } catch (e) {
    res.status(statusFromError(e)).json({ error: messageFromError(e) });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const idGrupo = parseIdParam(paramId(req.params.id));
    if (!idGrupo) throw Object.assign(new Error("Proyecto inválido"), { status: 400 });
    const supabase = createAdminClient();
    const { data: row, error } = await supabase
      .from("grupos_proyectos")
      .select(GRUPO_PROJECT_SELECT)
      .eq("id_grupo", idGrupo)
      .single();
    if (error || !row) throw Object.assign(new Error("Proyecto no encontrado"), { status: 404 });
    res.json({ project: await buildAdminDetail(supabase, row as GrupoProyectoRow) });
  } catch (e) {
    res.status(statusFromError(e)).json({ error: messageFromError(e) });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const idGrupo = parseIdParam(paramId(req.params.id));
    if (!idGrupo) throw Object.assign(new Error("Proyecto inválido"), { status: 400 });
    const payload = readProjectUpdatePayload(req.body);
    if (payload.name !== undefined && !payload.name) {
      throw Object.assign(new Error("El nombre es obligatorio"), { status: 400 });
    }
    const supabase = createAdminClient();
    const patch: Record<string, unknown> = {};
    if (payload.name !== undefined) patch.nombre_proyecto = payload.name;
    if (payload.status !== undefined) patch.estado_proyecto = payload.status;
    if (payload.objective !== undefined) patch.descripcion = payload.objective || null;
    if (payload.scopeDetail !== undefined) patch.alcance_detalle = payload.scopeDetail || null;
    if (payload.scopeNotes !== undefined) patch.notas_alcance = payload.scopeNotes || null;
    if (payload.preprojectValidated !== undefined) {
      patch.anteproyecto_validado = payload.preprojectValidated;
    }
    if (payload.backupLink !== undefined) patch.link_respaldo = payload.backupLink || null;
    if (payload.documents !== undefined) {
      patch.documentos = payload.documents.flatMap((d) => {
        const url = d.url?.trim();
        if (!url) return [];
        return [{ nombre: d.name?.trim() || url, url }];
      });
    }
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from("grupos_proyectos")
        .update(patch)
        .eq("id_grupo", idGrupo);
      if (error) throw Object.assign(new Error(error.message), { status: 400 });
    }
    if (payload.memberEmails !== undefined) {
      const { notFound } = await syncGroupMembers(supabase, idGrupo, payload.memberEmails);
      if (notFound.length > 0) {
        throw Object.assign(
          new Error(`No hay cuenta registrada para: ${notFound.join(", ")}`),
          { status: 400 }
        );
      }
    }
    const { data: row, error: fetchError } = await supabase
      .from("grupos_proyectos")
      .select(GRUPO_PROJECT_SELECT)
      .eq("id_grupo", idGrupo)
      .single();
    if (fetchError || !row) throw Object.assign(new Error("Proyecto no encontrado"), { status: 404 });
    res.json({ project: await buildAdminDetail(supabase, row as GrupoProyectoRow) });
  } catch (e) {
    res.status(statusFromError(e)).json({ error: messageFromError(e) });
  }
});

router.patch("/:id/bloqueos", async (req, res) => {
  try {
    const idGrupo = parseIdParam(paramId(req.params.id));
    if (!idGrupo) throw Object.assign(new Error("Proyecto inválido"), { status: 400 });
    const locks = readLocksOnlyPayload(req.body);
    const patch = locksToDbPatch(locks);
    if (Object.keys(patch).length === 0) {
      throw Object.assign(new Error("Indicá al menos un bloqueo"), { status: 400 });
    }
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("grupos_proyectos")
      .update(patch)
      .eq("id_grupo", idGrupo);
    if (error) throw Object.assign(new Error(error.message), { status: 400 });
    const { data: row, error: fetchError } = await supabase
      .from("grupos_proyectos")
      .select(GRUPO_PROJECT_SELECT)
      .eq("id_grupo", idGrupo)
      .single();
    if (fetchError || !row) throw Object.assign(new Error("Proyecto no encontrado"), { status: 404 });
    res.json({ project: await buildAdminDetail(supabase, row as GrupoProyectoRow) });
  } catch (e) {
    res.status(statusFromError(e)).json({ error: messageFromError(e) });
  }
});

router.put("/:id/profesores", async (req, res) => {
  try {
    const idGrupo = parseIdParam(paramId(req.params.id));
    if (!idGrupo) throw Object.assign(new Error("Proyecto inválido"), { status: 400 });
    const professorIds = readIdArray((req.body as { professorIds?: unknown }).professorIds, "Profesores");
    const supabase = createAdminClient();
    const { data: existing, error: existingError } = await supabase
      .from("grupos_proyectos")
      .select("id_grupo")
      .eq("id_grupo", idGrupo)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (!existing) throw Object.assign(new Error("Proyecto no encontrado"), { status: 404 });
    await assertProfessorIds(supabase, professorIds);
    await supabase.from("proyecto_profesor_asignado").delete().eq("id_grupo", idGrupo);
    if (professorIds.length > 0) {
      const { error } = await supabase.from("proyecto_profesor_asignado").insert(
        professorIds.map((id_profesor) => ({ id_grupo: idGrupo, id_profesor }))
      );
      if (error) throw Object.assign(new Error(error.message), { status: 400 });
    }
    const { data: row, error: fetchError } = await supabase
      .from("grupos_proyectos")
      .select(GRUPO_PROJECT_SELECT)
      .eq("id_grupo", idGrupo)
      .single();
    if (fetchError || !row) throw Object.assign(new Error("Proyecto no encontrado"), { status: 404 });
    res.json({ project: await buildAdminDetail(supabase, row as GrupoProyectoRow) });
  } catch (e) {
    res.status(statusFromError(e)).json({ error: messageFromError(e) });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const idGrupo = parseGroupId(paramId(req.params.id));
    if (!idGrupo) throw Object.assign(new Error("Proyecto inválido"), { status: 400 });
    const supabase = createAdminClient();
    const { data: existing, error: existingError } = await supabase
      .from("grupos_proyectos")
      .select("id_grupo")
      .eq("id_grupo", idGrupo)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (!existing) throw Object.assign(new Error("Proyecto no encontrado"), { status: 404 });
    await deleteProjectCascade(supabase, idGrupo);
    res.json({ deleted: String(idGrupo) });
  } catch (e) {
    res.status(statusFromError(e)).json({ error: messageFromError(e) });
  }
});

export default router;
