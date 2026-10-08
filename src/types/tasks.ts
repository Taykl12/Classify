export type TaskStatus = "Pendiente" | "En Progreso" | "Completado";
export type TaskPriority = "Baja" | "Media" | "Alta";

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  deadline: string | null;
  createdAt: string | null;
  createdBy: string | null;
}

export interface TaskInput {
  projectId: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  deadline: string | null;
}

export const TASK_STATUSES: TaskStatus[] = ["Pendiente", "En Progreso", "Completado"];
export const TASK_PRIORITIES: TaskPriority[] = ["Baja", "Media", "Alta"];

export interface TasksResponse {
  tasks: Task[];
}
