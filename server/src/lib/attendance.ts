/**
 * Utilidades de fecha/hora para la asistencia de profesores.
 *
 * La fecha y hora SIEMPRE se determinan en el backend usando la zona horaria del
 * establecimiento (no el reloj del ESP32). La ausencia no se persiste: se calcula
 * al leer según la configuración.
 */

export type TeacherAttendanceStatus = "Presente" | "Tardanza" | "Ausente" | "Justificado";

export interface AttendanceConfig {
  horaEntrada: string; // "HH:MM"
  toleranciaMinutos: number;
  minutosAusencia: number;
  /** Días laborables en ISO: 1=Lunes ... 7=Domingo. */
  diasLaborables: number[];
}

export const DEFAULT_ATTENDANCE_CONFIG: AttendanceConfig = {
  horaEntrada: "08:00",
  toleranciaMinutos: 10,
  minutosAusencia: 120,
  diasLaborables: [1, 2, 3, 4, 5],
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Normaliza valores `time` de Postgres ("08:00:00") a "HH:MM". */
export function normalizeTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : null;
}

export function timeToMinutes(value: string | null | undefined): number | null {
  const normalized = normalizeTime(value);
  if (!normalized || !TIME_RE.test(normalized)) return null;
  const [hour, minute] = normalized.split(":").map(Number);
  return hour * 60 + minute;
}

export function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(totalMinutes, 24 * 60 - 1));
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function normalizeDiasLaborables(value: unknown): number[] {
  if (!Array.isArray(value)) return [...DEFAULT_ATTENDANCE_CONFIG.diasLaborables];
  const days = value
    .map((item) => Number(item))
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7);
  const unique = [...new Set(days)].sort((a, b) => a - b);
  return unique.length > 0 ? unique : [...DEFAULT_ATTENDANCE_CONFIG.diasLaborables];
}

/**
 * Devuelve fecha/hora local del establecimiento para un instante dado.
 * `fecha` en formato YYYY-MM-DD y `isoWeekday` 1=Lunes ... 7=Domingo.
 */
export function getZonedDateTime(
  date: Date,
  timeZone: string
): { fecha: string; hora: string; isoWeekday: number } {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  const parts = formatter.formatToParts(date);
  const get = (type: string): string =>
    parts.find((part) => part.type === type)?.value ?? "00";

  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour") === "24" ? "00" : get("hour");
  const minute = get("minute");

  const utcDay = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).getUTCDay();
  const isoWeekday = ((utcDay + 6) % 7) + 1;

  return {
    fecha: `${year}-${month}-${day}`,
    hora: `${hour}:${minute}`,
    isoWeekday,
  };
}

export function isoWeekdayFromDate(fecha: string): number {
  const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return 1;
  const utcDay = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  ).getUTCDay();
  return ((utcDay + 6) % 7) + 1;
}

export function isWorkday(isoWeekday: number, diasLaborables: number[]): boolean {
  return diasLaborables.includes(isoWeekday);
}

/** Aplaza el estado de una marcación según la tolerancia configurada. */
export function computeEntryStatus(
  horaEntrada: string,
  config: AttendanceConfig
): Extract<TeacherAttendanceStatus, "Presente" | "Tardanza"> {
  const entryMinutes = timeToMinutes(horaEntrada);
  const expectedMinutes = timeToMinutes(config.horaEntrada);
  if (entryMinutes === null || expectedMinutes === null) return "Presente";
  return entryMinutes <= expectedMinutes + config.toleranciaMinutos
    ? "Presente"
    : "Tardanza";
}

export interface DayResolutionInput {
  fecha: string;
  /** Marcación persistida (si existe). */
  record: {
    estado: TeacherAttendanceStatus;
    horaEntrada: string | null;
  } | null;
  config: AttendanceConfig;
  /** Fecha y hora actuales en la zona del establecimiento. */
  now: { fecha: string; hora: string };
}

export type ResolvedDayStatus = TeacherAttendanceStatus | "Sin marcar" | "No corresponde";

/**
 * Determina el estado a mostrar para un profesor en un día:
 * - Si hay marcación persistida, ese estado manda.
 * - Día no laborable sin marcación → "No corresponde".
 * - Día laborable sin marcación y aún dentro de la ventana → "Sin marcar".
 * - Día laborable sin marcación y pasada la ventana → "Ausente".
 */
export function resolveDayStatus(input: DayResolutionInput): ResolvedDayStatus {
  const { fecha, record, config, now } = input;

  if (record) return record.estado;

  const isoWeekday = isoWeekdayFromDate(fecha);
  if (!isWorkday(isoWeekday, config.diasLaborables)) return "No corresponde";

  if (fecha > now.fecha) return "Sin marcar";

  const expectedMinutes = timeToMinutes(config.horaEntrada) ?? 0;
  const nowMinutes = timeToMinutes(now.hora) ?? 0;

  if (fecha < now.fecha) return "Ausente";

  return nowMinutes > expectedMinutes + config.minutosAusencia ? "Ausente" : "Sin marcar";
}

export const TEACHER_STATUS_LABELS: Record<ResolvedDayStatus, string> = {
  Presente: "Presente",
  Tardanza: "Tardanza",
  Ausente: "Ausente",
  Justificado: "Justificado",
  "Sin marcar": "Sin marcar",
  "No corresponde": "No corresponde",
};
