export type AttendanceStatus = "Presente" | "Ausente" | "Tardanza";

export interface AttendanceRecordDetail {
  student: ProfessorStudent;
  estado: AttendanceStatus;
  observaciones: string;
}

export interface AttendanceDetailResponse {
  fecha: string;
  registros: AttendanceRecordDetail[];
  presentes: number;
  total: number;
}

export interface ProfessorCourse {
  id: string;
  name: string;
  year: number;
  division: string;
  specialty: string;
  studentCount: number;
}

export interface ProfessorStudent {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  profilePhotoUrl: string | null;
}

export interface ProfessorSummary {
  courses: number;
  students: number;
}

export interface AttendanceSession {
  fecha: string;
  presentes: number;
  total: number;
}

export interface ProfessorCoursesResponse {
  courses: ProfessorCourse[];
}

export interface ProfessorStudentsResponse {
  course: ProfessorCourse;
  students: ProfessorStudent[];
}

export interface ProfessorAttendanceResponse {
  sessions: AttendanceSession[];
  totalStudents: number;
}

export interface AttendanceSubmitPayload {
  fecha: string;
  registros: Array<{
    id_usuario: string;
    estado: AttendanceStatus;
    observaciones?: string;
  }>;
}
