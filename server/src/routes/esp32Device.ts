import express, {
  type NextFunction,
  type Request,
  type Response,
  Router,
} from "express";
import { config } from "../config.js";
import {
  claimPendingDeviceJob,
  completeDeviceJob,
  getNextQueueItem,
  hasActiveDeviceJob,
  markDeviceJobProcessing,
  markItemDone,
} from "../lib/deviceJobState.js";
import {
  claimPending,
  completeError,
  completeSuccess,
  getActiveSession,
  hasActiveUserFingerprintSession,
  updateStep,
  type FingerprintStep,
} from "../lib/fingerprintState.js";
import {
  deleteTemplate,
  saveTemplate,
} from "../lib/fingerprintTemplates.js";
import { createAdminClient } from "../lib/supabase.js";
import {
  getEsp32Status,
  recordButtonPress,
  recordHeartbeat,
} from "../lib/esp32State.js";
import {
  computeEntryStatus,
  getZonedDateTime,
  normalizeTime,
  type TeacherAttendanceStatus,
} from "../lib/attendance.js";
import {
  findProfessorByHuella,
  getAttendanceConfig,
  getProfessorRoleId,
  professorFullName,
} from "../lib/teacherAttendance.js";

const router = Router();

interface MarkingRow {
  id_asistencia_profesor: number;
  hora_entrada: string | null;
  estado: TeacherAttendanceStatus;
  metodo_registro: "Huella" | "Manual";
}

router.use(express.json());

function requireDeviceToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.header("X-Device-Token");
  if (!token || token !== config.esp32DeviceToken) {
    res.status(401).json({ error: "Token de dispositivo inválido" });
    return;
  }
  next();
}

router.use(requireDeviceToken);

router.get("/heartbeat", (_req, res) => {
  recordHeartbeat();
  res.json({ ok: true });
});

router.post("/heartbeat", (_req, res) => {
  recordHeartbeat();
  res.json({ ok: true });
});

router.post("/button", (_req, res) => {
  recordButtonPress();
  res.json({ ok: true, ...getEsp32Status() });
});

/**
 * Marcación de asistencia de un profesor: el AS608 identifica la huella y el
 * ESP32 envía el `fingerprint_id` (slot = usuarios.huella_id). El backend decide
 * fecha, hora y estado; el dispositivo nunca fija la hora.
 *
 * Un mismo profesor solo puede tener una marcación por día: reintentos devuelven
 * la existente (`duplicado: true`) sin crear otra fila.
 */
router.post("/asistencia", async (req, res) => {
  recordHeartbeat();

  const rawId =
    req.body?.fingerprint_id ?? req.body?.fingerprintId ?? req.body?.slotId;
  const huellaId = Number(rawId);
  if (!Number.isInteger(huellaId) || huellaId < 0 || huellaId > 199) {
    res.status(400).json({ error: "fingerprint_id inválido" });
    return;
  }

  const supabase = createAdminClient();

  try {
    const professorRoleId = await getProfessorRoleId(supabase);
    if (professorRoleId === null) {
      res.status(500).json({ error: "No se pudo resolver el rol Profesor" });
      return;
    }

    const professor = await findProfessorByHuella(supabase, professorRoleId, huellaId);
    if (!professor) {
      // Huella inexistente o asignada a un usuario que no es profesor autorizado.
      res.status(404).json({ error: "Huella no registrada para un profesor" });
      return;
    }

    const attendanceConfig = await getAttendanceConfig(supabase);
    const now = getZonedDateTime(new Date(), config.attendanceTimeZone);

    const { data: existing, error: existingError } = await supabase
      .from("asistencias_profesores")
      .select("id_asistencia_profesor, hora_entrada, estado, metodo_registro")
      .eq("id_usuario", professor.id_usuario)
      .eq("fecha", now.fecha)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    if (existing) {
      const row = existing as MarkingRow;
      res.json({
        ok: true,
        duplicado: true,
        profesor: professorFullName(professor),
        fecha: now.fecha,
        horaEntrada: normalizeTime(row.hora_entrada),
        estado: row.estado,
        metodo: row.metodo_registro,
      });
      return;
    }

    const estado = computeEntryStatus(now.hora, attendanceConfig);

    const { data: inserted, error: insertError } = await supabase
      .from("asistencias_profesores")
      .insert({
        id_usuario: professor.id_usuario,
        fecha: now.fecha,
        hora_entrada: now.hora,
        estado,
        metodo_registro: "Huella",
        huella_id: huellaId,
      })
      .select("id_asistencia_profesor, hora_entrada, estado, metodo_registro")
      .single();

    if (insertError) {
      // Carrera: dos marcaciones simultáneas → devolvemos la ya persistida.
      const { data: raced } = await supabase
        .from("asistencias_profesores")
        .select("id_asistencia_profesor, hora_entrada, estado, metodo_registro")
        .eq("id_usuario", professor.id_usuario)
        .eq("fecha", now.fecha)
        .maybeSingle();
      if (raced) {
        const row = raced as MarkingRow;
        res.json({
          ok: true,
          duplicado: true,
          profesor: professorFullName(professor),
          fecha: now.fecha,
          horaEntrada: normalizeTime(row.hora_entrada),
          estado: row.estado,
          metodo: row.metodo_registro,
        });
        return;
      }
      throw new Error(insertError.message);
    }

    const row = inserted as MarkingRow;
    res.status(201).json({
      ok: true,
      duplicado: false,
      profesor: professorFullName(professor),
      fecha: now.fecha,
      horaEntrada: normalizeTime(row.hora_entrada),
      estado: row.estado,
      metodo: row.metodo_registro,
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Error interno" });
  }
});

router.get("/huella/pendiente", (_req, res) => {
  recordHeartbeat();
  const claimed = claimPending();
  if (!claimed.pending) {
    res.json({ pending: false });
    return;
  }

  res.json({
    pending: true,
    sessionId: claimed.sessionId,
    slotId: claimed.slotId,
    mode: claimed.mode,
    userId: claimed.userId,
  });
});

const VALID_STEPS: FingerprintStep[] = [
  "place_finger",
  "remove_finger",
  "place_again",
  "processing",
];

router.post("/huella/progreso", (req, res) => {
  recordHeartbeat();
  const sessionId = String(req.body?.sessionId ?? "").trim();
  const step = req.body?.step as FingerprintStep;

  if (!sessionId || !VALID_STEPS.includes(step)) {
    res.status(400).json({ error: "sessionId o step inválido" });
    return;
  }

  const ok = updateStep(sessionId, step);
  if (!ok) {
    res.status(404).json({ error: "Sesión no encontrada" });
    return;
  }

  res.json({ ok: true });
});

router.post("/huella/resultado", async (req, res) => {
  recordHeartbeat();
  const sessionId = String(req.body?.sessionId ?? "").trim();
  const success = req.body?.success === true;
  const slotId =
    req.body?.slotId !== undefined ? Number(req.body.slotId) : undefined;
  const errorMessage =
    typeof req.body?.error === "string" ? req.body.error.trim() : "";
  const templateBase64 =
    typeof req.body?.templateBase64 === "string"
      ? req.body.templateBase64.trim()
      : "";

  if (!sessionId) {
    res.status(400).json({ error: "sessionId requerido" });
    return;
  }

  const session = getActiveSession();
  if (!session || session.sessionId !== sessionId) {
    res.status(404).json({ error: "Sesión no encontrada" });
    return;
  }

  if (!success) {
    completeError(sessionId, errorMessage || "Error en el sensor de huella");
    res.json({ ok: true });
    return;
  }

  const supabase = createAdminClient();

  try {
    if (session.mode === "enroll") {
      const resolvedSlot = slotId ?? session.slotId;
      const { error } = await supabase
        .from("usuarios")
        .update({ huella_id: resolvedSlot })
        .eq("id_usuario", session.userId);

      if (error) {
        completeError(sessionId, error.message);
        res.status(500).json({ error: error.message });
        return;
      }

      if (templateBase64.length > 0) {
        try {
          await saveTemplate(session.userId, resolvedSlot, templateBase64);
        } catch (templateError) {
          const message =
            templateError instanceof Error
              ? templateError.message
              : "Error al guardar template";
          completeError(sessionId, message);
          res.status(500).json({ error: message });
          return;
        }
      }
    } else if (session.mode === "delete") {
      const { error } = await supabase
        .from("usuarios")
        .update({ huella_id: null })
        .eq("id_usuario", session.userId);

      if (error) {
        completeError(sessionId, error.message);
        res.status(500).json({ error: error.message });
        return;
      }

      try {
        await deleteTemplate(session.userId);
      } catch (templateError) {
        const message =
          templateError instanceof Error
            ? templateError.message
            : "Error al borrar template";
        completeError(sessionId, message);
        res.status(500).json({ error: message });
        return;
      }
    }
    // mode === "verify": no cambia BD; solo confirma match en el sensor

    completeSuccess(sessionId);
    res.json({ ok: true, slotId: session.slotId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error interno";
    completeError(sessionId, message);
    res.status(500).json({ error: message });
  }
});

router.get("/huella/lote/pendiente", (_req, res) => {
  recordHeartbeat();

  if (hasActiveUserFingerprintSession()) {
    res.json({ pending: false });
    return;
  }

  const claimed = claimPendingDeviceJob();
  if (!claimed.pending) {
    res.json({ pending: false });
    return;
  }

  markDeviceJobProcessing(claimed.sessionId);

  res.json({
    pending: true,
    sessionId: claimed.sessionId,
    jobType: claimed.jobType,
    total: claimed.jobType === "restore" ? claimed.queue.length : null,
  });
});

router.get("/huella/lote/siguiente", (req, res) => {
  recordHeartbeat();
  const sessionId = String(req.query.sessionId ?? "").trim();

  if (!sessionId) {
    res.status(400).json({ error: "sessionId requerido" });
    return;
  }

  try {
    const next = getNextQueueItem(sessionId);
    if (next.done) {
      res.json({ done: true });
      return;
    }

    res.json({
      done: false,
      index: next.index,
      userId: next.userId,
      slotId: next.slotId,
      templateBase64: next.templateBase64,
    });
  } catch (e) {
    const status =
      typeof e === "object" && e !== null && "status" in e
        ? Number((e as { status: unknown }).status) || 500
        : 500;
    const message = e instanceof Error ? e.message : "Error interno";
    res.status(status).json({ error: message });
  }
});

router.post("/huella/lote/progreso", async (req, res) => {
  recordHeartbeat();
  const sessionId = String(req.body?.sessionId ?? "").trim();
  const index =
    req.body?.index !== undefined ? Number(req.body.index) : undefined;
  const success = req.body?.success === true;
  const slotId =
    req.body?.slotId !== undefined ? Number(req.body.slotId) : undefined;
  const userId =
    typeof req.body?.userId === "string" ? req.body.userId.trim() : "";

  if (!sessionId || index === undefined || Number.isNaN(index)) {
    res.status(400).json({ error: "sessionId e index requeridos" });
    return;
  }

  const ok = markItemDone(sessionId, index, success);
  if (!ok) {
    res.status(404).json({ error: "Sesión o índice no válido" });
    return;
  }

  if (success && userId && slotId !== undefined && !Number.isNaN(slotId)) {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("usuarios")
      .update({ huella_id: slotId })
      .eq("id_usuario", userId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
  }

  res.json({ ok: true });
});

router.post("/huella/lote/resultado", async (req, res) => {
  recordHeartbeat();
  const sessionId = String(req.body?.sessionId ?? "").trim();
  const success = req.body?.success === true;
  const errorMessage =
    typeof req.body?.error === "string" ? req.body.error.trim() : "";

  if (!sessionId) {
    res.status(400).json({ error: "sessionId requerido" });
    return;
  }

  if (!hasActiveDeviceJob()) {
    res.status(404).json({ error: "Sesión de lote no encontrada" });
    return;
  }

  const job = completeDeviceJob(
    sessionId,
    success,
    errorMessage || undefined
  );

  if (!job) {
    res.status(404).json({ error: "Sesión de lote no encontrada" });
    return;
  }

  if (success && job.jobType === "wipe") {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("usuarios")
      .update({ huella_id: null })
      .not("huella_id", "is", null);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
  }

  res.json({
    ok: true,
    jobType: job.jobType,
    succeeded: job.succeeded,
    failed: job.failed,
  });
});

export default router;
