export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  date: string;
  projectName: string;
  projectId: string;
  type: "event";
  priority?: string;
}

export interface EventsByDate {
  [dateKey: string]: CalendarEvent[];
}
