type ProjectListStatus = "Abierto" | "Cerrado";

export interface GrupoProyectoRow {
  id_grupo: number;
  nombre_proyecto: string;
  descripcion: string | null;
  fecha_creacion: string;
  escuela: string | null;
  estado_proyecto: string | null;
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
  return {
    id: String(row.id_grupo),
    school: row.escuela ?? "â€”",
    name: row.nombre_proyecto,
    description: row.descripcion ?? "",
    status: status === "Cerrado" ? "Cerrado" : "Abierto",
    createdAt: formatDate(row.fecha_creacion),
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
  const summary = row.titulo_tarea?.trim() || row.descripcion_tarea?.trim() || "Sin descripciÃ³n";
  return {
    id: String(row.id_tarea),
    summary,
    projectName,
    priority: mapPriority(row.prioridad_tarea),
    status: mapTaskStatus(row.estado_tarea),
  };
}