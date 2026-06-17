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
  createdAt: string;
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
