import { courseCycleLabel, yearSelectLabel } from "./adminAcademic";
import type { ProfessorCourse, ProfessorStudent } from "../types/professor";

export function studentFullName(student: ProfessorStudent): string {
  return [student.lastName, student.firstName].filter(Boolean).join(", ") || "Sin nombre";
}

export function studentInitials(student: ProfessorStudent): string {
  const first = student.firstName.charAt(0);
  const last = student.lastName.charAt(0);
  const initials = `${last}${first}`.trim();
  return initials ? initials.toUpperCase() : "?";
}

export function courseYearLabel(course: ProfessorCourse): string {
  return yearSelectLabel(course.year);
}

export function courseOrientationLabel(course: ProfessorCourse): string {
  return courseCycleLabel(course.year, course.specialty);
}

export function formatAttendanceDate(fecha: string): string {
  const date = new Date(`${fecha}T12:00:00`);
  if (Number.isNaN(date.getTime())) return fecha;
  return date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
