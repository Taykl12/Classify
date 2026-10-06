export interface AdminRole {
  id: number;
  name: string;
  label: string;
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  dni: string;
  phone: string;
  roleId: number | null;
  roleLabel: string;
  profilePhotoUrl: string | null;
  huellaId: number | null;
  createdAt: string;
}

export type FingerprintStep =
  | "requested"
  | "claimed"
  | "place_finger"
  | "remove_finger"
  | "place_again"
  | "processing"
  | "success"
  | "error";

export interface FingerprintStatus {
  active: boolean;
  step: FingerprintStep | null;
  slotId: number | null;
  errorMessage: string | null;
}

export interface AdminCourse {
  id: string;
  name: string;
  year: number;
  division: string;
  specialty: string;
  assignedUserIds: string[];
  subjectCount: number;
}

export interface AdminSubject {
  id: string;
  name: string;
  courseId: string;
  courseName: string;
  horario: string;
  professorIds: string[];
}

export interface AdminSummary {
  users: number;
  courses: number;
  subjects: number;
}

export interface Esp32Status {
  connected: boolean;
  pressCount: number;
  lastSeenAt: string | null;
}

export interface DeviceJobStatus {
  active: boolean;
  jobType: "wipe" | "restore" | null;
  total: number | null;
  index: number | null;
  succeeded: number | null;
  failed: number | null;
  errorMessage: string | null;
}

export interface ProjectLocks {
  scope: boolean;
  documentation: boolean;
  team: boolean;
}

export interface AdminProject {
  id: string;
  name: string;
  status: "Abierto" | "Cerrado";
  ownerEmail: string | null;
  assignedProfessorIds: string[];
  memberCount: number;
  locks: ProjectLocks;
  createdAt: string;
  description?: string;
  objective?: string;
  scopeDetail?: string;
  scopeNotes?: string;
  preprojectValidated?: boolean;
  backupLink?: string;
  documents?: { name: string; url: string }[];
  memberEmails?: string[];
}

export interface AdminProjectsResponse {
  projects: AdminProject[];
}

export interface AdminProjectResponse {
  project: AdminProject;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  roles: AdminRole[];
}

export interface AdminCoursesResponse {
  courses: AdminCourse[];
}

export interface AdminSubjectsResponse {
  subjects: AdminSubject[];
}

export type TeacherAttendanceEstado =
  | "Presente"
  | "Tardanza"
  | "Ausente"
  | "Justificado";
export type TeacherAttendanceDisplayEstado =
  | TeacherAttendanceEstado
  | "Sin marcar"
  | "No corresponde";

export interface TeacherAttendanceRecord {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePhotoUrl: string | null;
  huellaId: number | null;
  fecha: string;
  horaEntrada: string | null;
  estado: TeacherAttendanceDisplayEstado;
  metodo: "Huella" | "Manual" | null;
  observaciones: string;
  corregido: boolean;
}

export interface TeacherAttendanceResumen {
  presentes: number;
  tardanzas: number;
  ausentes: number;
  justificados: number;
  sinMarcar: number;
  total: number;
}

export interface TeacherAttendanceResponse {
  fecha: string;
  esDiaLaborable: boolean;
  horaEntradaEsperada: string;
  resumen: TeacherAttendanceResumen;
  registros: TeacherAttendanceRecord[];
}

export interface TeacherAttendanceConfig {
  horaEntrada: string;
  toleranciaMinutos: number;
  minutosAusencia: number;
  diasLaborables: number[];
}

export interface TeacherAttendanceHistoryItem {
  fecha: string;
  horaEntrada: string | null;
  estado: TeacherAttendanceEstado;
  metodo: "Huella" | "Manual";
  observaciones: string;
  corregido: boolean;
}

export interface TeacherAttendanceHistoryResponse {
  profesor: {
    userId: string;
    firstName: string;
    lastName: string;
    profilePhotoUrl: string | null;
    huellaId: number | null;
    nombreCompleto: string;
  };
  historial: TeacherAttendanceHistoryItem[];
}
