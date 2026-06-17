import { Router } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { composeCourseName } from "../lib/adminAcademic.js";
import { requireProfessor } from "../middleware/professor.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { createAdminClient } from "../lib/supabase.js";

const router = Router();

const ATTENDANCE_COUNTS_AS_PRESENT = new Set(["Presente", "Tardanza"]);
const VALID_ATTENDANCE_STATES = new Set([
  "Presente",
  "Ausente",
  "Tardanza",
  "Justificado",
]);

interface CourseRow {
  id_curso: number;
  nombre_curso: string;
  anio_lectivo: number;
  especialidad: string | null;
  division: string | null;
}

interface AssignmentRow {
  id_curso: number;
  id_usuario: string;
  rol_en_curso: string;
}

interface StudentRow {
  id_usuario: string;
  nombre: string | null;
  apellido: string | null;
  dni: string | null;
  foto_perfil: string | null;
}

interface ProfessorCourseDto {
  id: string;
  name: string;
  year: number;
  division: string;
  specialty: string;
  studentCount: number;
}

interface ProfessorStudentDto {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  profilePhotoUrl: string | null;
}

interface AttendanceSessionDto {
  fecha: string;
  presentes: number;
  total: number;
}

type AttendanceStatus = "Presente" | "Ausente" | "Tardanza" | "Justificado";

interface AttendanceRecord {
  id_usuario: string;
  estado: AttendanceStatus;
  observaciones?: string;
}

function parseIdParam(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function statusFromError(e: unknown): number {
  return typeof e === "object" && e !== null && "status" in e
    ? Number((e as { status: unknown }).status) || 500
    : 500;
}

function messageFromError(e: unknown): string {
  return e instanceof Error ? e.message : "Error interno";
}

async function getProfessorCourseIds(
  supabase: SupabaseClient,
  professorId: string
): Promise<number[]> {
  const [courseAssignments, subjectAssignments] = await Promise.all([
    supabase
      .from("cursos_usuarios_asignados")
      .select("id_curso")
      .eq("id_usuario", professorId)
      .eq("rol_en_curso", "profesor"),
    supabase
      .from("materia_profesor")
      .select("id_materia, materias(id_curso)")
      .eq("id_profesor", professorId),
  ]);
  if (courseAssignments.error) throw new Error(courseAssignments.error.message);
  if (subjectAssignments.error) throw new Error(subjectAssignments.error.message);

  const courseIds = new Set<number>();
  for (const assignment of courseAssignments.data ?? []) {
    courseIds.add(assignment.id_curso as number);
  }

  for (const assignment of subjectAssignments.data ?? []) {
    const materia = assignment.materias as
      | { id_curso: number }
      | { id_curso: number }[]
      | null;
    const idCurso = Array.isArray(materia) ? materia[0]?.id_curso : materia?.id_curso;
    if (typeof idCurso === "number") courseIds.add(idCurso);
  }

  return Array.from(courseIds);
}

async function assertProfessorInCourse(
  supabase: SupabaseClient,
  professorId: string,
  courseId: number
): Promise<void> {
  const courseIds = await getProfessorCourseIds(supabase, professorId);
  if (!courseIds.includes(courseId)) {
    throw Object.assign(new Error("Curso no asignado"), { status: 403 });
  }
}

function mapCourse(row: CourseRow, studentCount: number): ProfessorCourseDto {
  const composed = composeCourseName(
    row.anio_lectivo,
    row.division ?? "",
    row.especialidad ?? ""
  );
  return {
    id: String(row.id_curso),
    name: composed || row.nombre_curso,
    year: row.anio_lectivo,
    division: row.division ?? "",
    specialty: row.especialidad ?? "",
    studentCount,
  };
}

function mapStudent(row: StudentRow): ProfessorStudentDto {
  return {
    id: row.id_usuario,
    firstName: row.nombre?.trim() ?? "",
    lastName: row.apellido?.trim() ?? "",
    dni: row.dni?.trim() ?? "",
    profilePhotoUrl: row.foto_perfil,
  };
}

async function listProfessorCourses(
  supabase: SupabaseClient,
  professorId: string
): Promise<ProfessorCourseDto[]> {
  const courseIds = await getProfessorCourseIds(supabase, professorId);
  if (courseIds.length === 0) return [];

  const [coursesResult, allAssignments] = await Promise.all([
    supabase
      .from("cursos")
      .select("id_curso, nombre_curso, anio_lectivo, especialidad, division")
      .in("id_curso", courseIds)
      .order("anio_lectivo", { ascending: true })
      .order("division", { ascending: true }),
    supabase
      .from("cursos_usuarios_asignados")
      .select("id_curso, id_usuario, rol_en_curso")
      .in("id_curso", courseIds),
  ]);
  if (coursesResult.error) throw new Error(coursesResult.error.message);
  if (allAssignments.error) throw new Error(allAssignments.error.message);

  const assignments = (allAssignments.data ?? []) as AssignmentRow[];
  return ((coursesResult.data ?? []) as CourseRow[]).map((course) => {
    const studentCount = assignments.filter(
      (assignment) =>
        assignment.id_curso === course.id_curso && assignment.rol_en_curso === "alumno"
    ).length;
    return mapCourse(course, studentCount);
  });
}

router.use(requireAuth, requireProfessor);

router.get("/summary", async (req, res) => {
  try {
    const { userId } = req as unknown as AuthedRequest;
    const supabase = createAdminClient();
    const courses = await listProfessorCourses(supabase, userId);
    const students = courses.reduce((sum, course) => sum + course.studentCount, 0);
    res.json({ courses: courses.length, students });
  } catch (e) {
    res.status(statusFromError(e)).json({ error: messageFromError(e) });
  }
});

router.get("/cursos", async (req, res) => {
  try {
    const { userId } = req as unknown as AuthedRequest;
    const supabase = createAdminClient();
    const courses = await listProfessorCourses(supabase, userId);
    res.json({ courses });
  } catch (e) {
    res.status(statusFromError(e)).json({ error: messageFromError(e) });
  }
});

router.get("/cursos/:id/alumnos", async (req, res) => {
  try {
    const { userId } = req as unknown as AuthedRequest;
    const courseId = parseIdParam(req.params.id);
    if (!courseId) throw Object.assign(new Error("Curso inválido"), { status: 400 });

    const supabase = createAdminClient();
    await assertProfessorInCourse(supabase, userId, courseId);

    const { data: courseRow, error: courseError } = await supabase
      .from("cursos")
      .select("id_curso, nombre_curso, anio_lectivo, especialidad, division")
      .eq("id_curso", courseId)
      .maybeSingle();
    if (courseError) throw new Error(courseError.message);
    if (!courseRow) throw Object.assign(new Error("Curso no encontrado"), { status: 404 });

    const { data: assignments, error: assignError } = await supabase
      .from("cursos_usuarios_asignados")
      .select("id_usuario")
      .eq("id_curso", courseId)
      .eq("rol_en_curso", "alumno");
    if (assignError) throw new Error(assignError.message);

    const studentIds = (assignments ?? []).map((assignment) => assignment.id_usuario);
    if (studentIds.length === 0) {
      res.json({
        course: mapCourse(courseRow as CourseRow, 0),
        students: [],
      });
      return;
    }

    const { data: users, error: usersError } = await supabase
      .from("usuarios")
      .select("id_usuario, nombre, apellido, dni, foto_perfil")
      .in("id_usuario", studentIds);
    if (usersError) throw new Error(usersError.message);

    const students = ((users ?? []) as StudentRow[])
      .map(mapStudent)
      .sort((a, b) => {
        const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
        const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
        return nameA.localeCompare(nameB, "es");
      });

    res.json({
      course: mapCourse(courseRow as CourseRow, students.length),
      students,
    });
  } catch (e) {
    res.status(statusFromError(e)).json({ error: messageFromError(e) });
  }
});

router.get("/cursos/:id/asistencias/:fecha", async (req, res) => {
  try {
    const { userId } = req as unknown as AuthedRequest;
    const courseId = parseIdParam(req.params.id);
    const fecha = typeof req.params.fecha === "string" ? req.params.fecha.trim() : "";
    if (!courseId) throw Object.assign(new Error("Curso inválido"), { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      throw Object.assign(new Error("Fecha inválida"), { status: 400 });
    }

    const supabase = createAdminClient();
    await assertProfessorInCourse(supabase, userId, courseId);

    const { data: rows, error } = await supabase
      .from("asistencias")
      .select("id_usuario, estado, observaciones")
      .eq("id_curso", courseId)
      .eq("fecha", fecha);
    if (error) throw new Error(error.message);
    if (!rows?.length) {
      throw Object.assign(new Error("No hay asistencia para esa fecha"), { status: 404 });
    }

    const studentIds = rows.map((row) => row.id_usuario as string);
    const { data: users, error: usersError } = await supabase
      .from("usuarios")
      .select("id_usuario, nombre, apellido, dni, foto_perfil")
      .in("id_usuario", studentIds);
    if (usersError) throw new Error(usersError.message);

    const usersById = new Map(
      ((users ?? []) as StudentRow[]).map((user) => [user.id_usuario, mapStudent(user)])
    );

    const registros = rows
      .map((row) => {
        const student = usersById.get(row.id_usuario as string);
        if (!student) return null;
        return {
          student,
          estado: row.estado as AttendanceStatus,
          observaciones: (row.observaciones as string | null)?.trim() ?? "",
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => {
        const nameA = `${a.student.lastName} ${a.student.firstName}`.toLowerCase();
        const nameB = `${b.student.lastName} ${b.student.firstName}`.toLowerCase();
        return nameA.localeCompare(nameB, "es");
      });

    const presentes = registros.filter((reg) =>
      ATTENDANCE_COUNTS_AS_PRESENT.has(reg.estado)
    ).length;

    res.json({
      fecha,
      registros,
      presentes,
      total: registros.length,
    });
  } catch (e) {
    res.status(statusFromError(e)).json({ error: messageFromError(e) });
  }
});

router.get("/cursos/:id/asistencias", async (req, res) => {
  try {
    const { userId } = req as unknown as AuthedRequest;
    const courseId = parseIdParam(req.params.id);
    if (!courseId) throw Object.assign(new Error("Curso inválido"), { status: 400 });

    const supabase = createAdminClient();
    await assertProfessorInCourse(supabase, userId, courseId);

    const { count: totalStudents, error: countError } = await supabase
      .from("cursos_usuarios_asignados")
      .select("*", { count: "exact", head: true })
      .eq("id_curso", courseId)
      .eq("rol_en_curso", "alumno");
    if (countError) throw new Error(countError.message);
    const total = totalStudents ?? 0;

    const { data: rows, error } = await supabase
      .from("asistencias")
      .select("fecha, estado")
      .eq("id_curso", courseId)
      .order("fecha", { ascending: false });
    if (error) throw new Error(error.message);

    const byDate = new Map<string, number>();
    for (const row of rows ?? []) {
      const fecha = row.fecha as string;
      if (!byDate.has(fecha)) byDate.set(fecha, 0);
      if (ATTENDANCE_COUNTS_AS_PRESENT.has(row.estado as string)) {
        byDate.set(fecha, (byDate.get(fecha) ?? 0) + 1);
      }
    }

    const sessions: AttendanceSessionDto[] = Array.from(byDate.entries())
      .map(([fecha, presentes]) => ({ fecha, presentes, total }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));

    res.json({ sessions, totalStudents: total });
  } catch (e) {
    res.status(statusFromError(e)).json({ error: messageFromError(e) });
  }
});

router.post("/cursos/:id/asistencias", async (req, res) => {
  try {
    const { userId } = req as unknown as AuthedRequest;
    const courseId = parseIdParam(req.params.id);
    if (!courseId) throw Object.assign(new Error("Curso inválido"), { status: 400 });

    const body = req.body as {
      fecha?: string;
      registros?: AttendanceRecord[];
    };

    const fecha = typeof body.fecha === "string" ? body.fecha.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      throw Object.assign(new Error("Fecha inválida"), { status: 400 });
    }

    const registros = Array.isArray(body.registros) ? body.registros : [];
    if (registros.length === 0) {
      throw Object.assign(new Error("No hay registros de asistencia"), { status: 400 });
    }

    for (const reg of registros) {
      if (typeof reg.id_usuario !== "string" || !reg.id_usuario) {
        throw Object.assign(new Error("Registro inválido"), { status: 400 });
      }
      if (!VALID_ATTENDANCE_STATES.has(reg.estado)) {
        throw Object.assign(new Error("Estado inválido"), { status: 400 });
      }
    }

    const supabase = createAdminClient();
    await assertProfessorInCourse(supabase, userId, courseId);

    const { data: assignments, error: assignError } = await supabase
      .from("cursos_usuarios_asignados")
      .select("id_usuario")
      .eq("id_curso", courseId)
      .eq("rol_en_curso", "alumno");
    if (assignError) throw new Error(assignError.message);

    const validStudentIds = new Set((assignments ?? []).map((assignment) => assignment.id_usuario));
    for (const reg of registros) {
      if (!validStudentIds.has(reg.id_usuario)) {
        throw Object.assign(new Error("Alumno no pertenece al curso"), { status: 400 });
      }
    }

    const { error: deleteError } = await supabase
      .from("asistencias")
      .delete()
      .eq("id_curso", courseId)
      .eq("fecha", fecha);
    if (deleteError) throw new Error(deleteError.message);

    const insertRows = registros.map((reg) => ({
      id_curso: courseId,
      id_usuario: reg.id_usuario,
      fecha,
      estado: reg.estado,
      observaciones: reg.observaciones?.trim() || null,
      id_registrado_por: userId,
    }));

    const { error: insertError } = await supabase.from("asistencias").insert(insertRows);
    if (insertError) throw new Error(insertError.message);

    const presentes = registros.filter((reg) =>
      ATTENDANCE_COUNTS_AS_PRESENT.has(reg.estado)
    ).length;

    res.status(201).json({
      session: { fecha, presentes, total: validStudentIds.size },
    });
  } catch (e) {
    res.status(statusFromError(e)).json({ error: messageFromError(e) });
  }
});

export default router;
