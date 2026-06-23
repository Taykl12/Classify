type ProjectListStatus = "Abierto" | "Cerrado";

export interface ProjectDocumentRow {
  nombre?: string;
  url?: string;
}

export interface GrupoProyectoRow {
  id_grupo: number;
  nombre_proyecto: string;
  descripcion: string | null;
  fecha_creacion: string;
  estado_proyecto: string | null;
  es_favorito?: boolean;
  alcance_detalle?: string | null;
  notas_alcance?: string | null;
  anteproyecto_validado?: boolean;
  link_respaldo?: string | null;
  link_calificaciones?: string | null;
  documentos?: ProjectDocumentRow[] | null;
  bloqueo_alcance?: boolean;
  bloqueo_documentacion?: boolean;
  bloqueo_equipo?: boolean;
}

export const GRUPO_PROJECT_SELECT =
  "id_grupo, nombre_proyecto, descripcion, fecha_creacion, estado_proyecto, es_favorito, alcance_detalle, notas_alcance, anteproyecto_validado, link_respaldo, link_calificaciones, documentos, bloqueo_alcance, bloqueo_documentacion, bloqueo_equipo";

export function mapProjectConfig(row: GrupoProyectoRow) {
  const docs = Array.isArray(row.documentos) ? row.documentos : [];
  return {
    scopeDetail: row.alcance_detalle ?? "",
    scopeNotes: row.notas_alcance ?? "",
    preprojectValidated: Boolean(row.anteproyecto_validado),
    backupLink: row.link_respaldo ?? "",
    gradesLink: row.link_calificaciones ?? "",
    documents: docs.flatMap((d) => {
      const url = d?.url?.trim();
      if (!url) return [];
      return [{ name: (d.nombre?.trim() || url) as string, url }];
    }),
  };
}

export function mapProjectDetail(row: GrupoProyectoRow) {
  return {
    ...mapProjectListItem(row),
    objective: row.descripcion ?? "",
    ...mapProjectConfig(row),
  };
}

export interface TareaGrupoRow {
  id_tarea: number;
  titulo_tarea: string | null;
  descripcion_tarea: string | null;
  prioridad_tarea: string;
  estado_tarea: string;
  id_grupo: number;
  grupos_proyectos?: { nombre_proyecto: string } | { nombre_proyecto: string }[] | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function mapTaskStatus(estado: string): "Pendiente" | "En curso" {
  if (estado === "En Progreso") return "En curso";
  return "Pendiente";
}

function mapPriority(p: string): "Alta" | "Media" | "Baja" {
  if (p === "Alta" || p === "Media" || p === "Baja") return p;
  return "Media";
}

export function mapProjectListItem(row: GrupoProyectoRow) {
  const status = (row.estado_proyecto ?? "Abierto") as ProjectListStatus;
  const scopeNotes = row.notas_alcance?.trim() ?? "";
  return {
    id: String(row.id_grupo),
    name: row.nombre_proyecto,
    description: row.descripcion ?? "",
    scopeNotes,
    status: status === "Cerrado" ? "Cerrado" : "Abierto",
    createdAt: formatDate(row.fecha_creacion),
    isFavorite: Boolean(row.es_favorito),
    preprojectValidated: Boolean(row.anteproyecto_validado),
  };
}

export function mapFeaturedProject(row: GrupoProyectoRow, pendingTasks: number) {
  return {
    id: String(row.id_grupo),
    name: row.nombre_proyecto,
    pendingTasks,
  };
}

export function mapPendingItem(row: TareaGrupoRow) {
  const gp = row.grupos_proyectos;
  const projectName = Array.isArray(gp)
    ? (gp[0]?.nombre_proyecto ?? "Proyecto")
    : (gp?.nombre_proyecto ?? "Proyecto");
  const summary = row.titulo_tarea?.trim() || row.descripcion_tarea?.trim() || "Sin descripción";
  return {
    id: String(row.id_tarea),
    summary,
    projectName,
    priority: mapPriority(row.prioridad_tarea),
    status: mapTaskStatus(row.estado_tarea),
  };
}