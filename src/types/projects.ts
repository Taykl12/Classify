export type ProjectListStatus = "Abierto" | "Cerrado";

export interface ProjectListItem {
  id: string;
  school: string;
  name: string;
  description: string;
  status: ProjectListStatus;
  createdAt: string;
}
