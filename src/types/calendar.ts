export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  date: string;
  projectName: string;
  projectId: string;
  type: "task" | "delivery";
  priority?: string;
  status?: string;
}

export interface EventsByDate {
  [dateKey: string]: CalendarEvent[];
}
