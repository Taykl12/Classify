export type ProjectListStatus = "Abierto" | "Cerrado";

export interface ProjectListItem {
  id: string;
  name: string;
  description: string;
  /** Notas de alcance (panel izquierdo en configuración). */
  scopeNotes: string;
  status: ProjectListStatus;
  createdAt: string;
  isFavorite: boolean;
  preprojectValidated?: boolean;
}

export interface ProjectDocument {
  name: string;
  url: string;
}

export interface ProjectFormValues {
  name: string;
  memberEmails: string[];
}

export interface ProjectDetail extends ProjectListItem {
  memberEmails: string[];
  objective?: string;
  scopeDetail?: string;
  preprojectValidated?: boolean;
  backupLink?: string;
  gradesLink?: string;
  documents?: ProjectDocument[];
  ownerEmail?: string | null;
  isOwner?: boolean;
}

export const EMPTY_PROJECT_FORM: ProjectFormValues = {
  name: "",
  memberEmails: [],
};

export type ProjectConfigTab = "alcance" | "equipo" | "calificaciones" | "documentaciones";
