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

export interface ProjectLocks {
  scope: boolean;
  documentation: boolean;
  team: boolean;
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
  assignedProfessorEmails?: string[];
  isOwner?: boolean;
  isAssignedProfessor?: boolean;
  canManageProject?: boolean;
  canManageLocks?: boolean;
  locks?: ProjectLocks;
}

export const EMPTY_PROJECT_FORM: ProjectFormValues = {
  name: "",
  memberEmails: [],
};

export type ProjectConfigTab = "alcance" | "equipo" | "calificaciones" | "documentaciones";
