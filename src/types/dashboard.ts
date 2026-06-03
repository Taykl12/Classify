export interface Project {
  id: string;
  name: string;
  pendingTasks: number;
}

export interface PendingItem {
  id: string;
  summary: string;
  projectName: string;
  priority: "Alta" | "Media" | "Baja";
  status: "Pendiente" | "En curso";
}
