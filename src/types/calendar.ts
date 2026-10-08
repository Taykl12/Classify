export type CalendarItemType = "event" | "task";

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  projectId: string;
  projectName: string;
  type: CalendarItemType;
  priority?: "Baja" | "Media" | "Alta";
  horaInicio: string | null;
  horaFin: string | null;
  recurrencia: "Ninguna" | "Diaria" | "Semanal" | "Mensual";
  readOnly: boolean;
  canEdit: boolean;
  taskId?: string;
  estado?: string;
}

export interface CalendarEventInput {
  projectId: string;
  title: string;
  description?: string;
  priority: string;
  eventDate: string;
  horaInicio?: string | null;
  horaFin?: string | null;
}

export interface EventsByDate {
  [dateKey: string]: CalendarEvent[];
}
