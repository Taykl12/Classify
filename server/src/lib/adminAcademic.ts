const DIVISION_COUNT_BY_YEAR: Record<number, number> = {
  1: 7,
  2: 5,
  3: 4,
  4: 4,
  5: 4,
  6: 4,
};

const SUPERIOR_ORIENTATION_OPTIONS = ["G.A.O", "I.P.P", "T.E.P"] as const;

const SCHEDULE_WEEKDAY_OPTIONS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

const SCHEDULE_HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) =>
  String(index).padStart(2, "0")
);

const SCHEDULE_MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0")
);

const WEEKDAY_PATTERN = SCHEDULE_WEEKDAY_OPTIONS.join("|");
const SLOT_SEGMENT_RE = new RegExp(
  `(${WEEKDAY_PATTERN})\\s+(\\d{2}:\\d{2})\\s*-\\s*(\\d{2}:\\d{2})`,
  "g"
);

export function isSuperiorYear(year: number): boolean {
  return year >= 3;
}

export function displayYearForInternalYear(year: number): number {
  return year <= 2 ? year : year - 2;
}

function normalizeSpecialty(value: string): string {
  const key = value.trim().replaceAll(".", "").toLowerCase();
  return (
    SUPERIOR_ORIENTATION_OPTIONS.find(
      (option) => option.replaceAll(".", "").toLowerCase() === key
    ) ?? ""
  );
}

export function specialtyForCourse(year: number, specialty: string): string {
  if (!isSuperiorYear(year)) return "Ciclo Basico";
  return normalizeSpecialty(specialty) || SUPERIOR_ORIENTATION_OPTIONS[0];
}

export function composeCourseName(
  internalYear: number,
  division: string,
  specialty: string
): string {
  const displayYear = displayYearForInternalYear(internalYear);
  return `${displayYear}° ${division} ${specialtyForCourse(internalYear, specialty)}`;
}

function parseDivisionNumber(division: string): number | null {
  const match = division.match(/^(\d+)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function validateDivisionForYear(year: number, division: string): void {
  const divisionNumber = parseDivisionNumber(division);
  const max = DIVISION_COUNT_BY_YEAR[year];
  if (!max || !divisionNumber || divisionNumber < 1 || divisionNumber > max) {
    throw Object.assign(new Error(`División inválida para el ${year}° año`), { status: 400 });
  }
}

export function validateSuperiorSpecialty(year: number, specialty: string): string {
  if (!isSuperiorYear(year)) return "Ciclo Basico";
  const normalized = normalizeSpecialty(specialty);
  if (!normalized) {
    throw Object.assign(new Error("Orientación requerida para ciclo superior"), {
      status: 400,
    });
  }
  return normalized;
}

function isValidWeekday(value: string): boolean {
  return (SCHEDULE_WEEKDAY_OPTIONS as readonly string[]).includes(value);
}

function isValidTimePart(hour: string, minute: string): boolean {
  return (
    SCHEDULE_HOUR_OPTIONS.includes(hour) &&
    (SCHEDULE_MINUTE_OPTIONS as readonly string[]).includes(minute)
  );
}

function validateTimeRange(startHour: string, startMinute: string, endHour: string, endMinute: string): void {
  if (!isValidTimePart(startHour, startMinute) || !isValidTimePart(endHour, endMinute)) {
    throw Object.assign(new Error("Horario inválido"), { status: 400 });
  }
  const start = `${startHour}:${startMinute}`;
  const end = `${endHour}:${endMinute}`;
  if (start >= end) {
    throw Object.assign(new Error("La hora de fin debe ser posterior al inicio"), {
      status: 400,
    });
  }
}

function parseLegacyHorarioSegments(trimmed: string): Array<{
  day: string;
  startHour: string;
  startMinute: string;
  endHour: string;
  endMinute: string;
}> {
  const timeMatch = trimmed.match(/\b(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})\s*$/);
  if (!timeMatch || timeMatch.index === undefined) return [];

  const dayPart = trimmed.slice(0, timeMatch.index).trim();
  const days = dayPart.includes(",")
    ? dayPart.split(",").map((day) => day.trim()).filter(isValidWeekday)
    : isValidWeekday(dayPart)
      ? [dayPart]
      : [];

  return days.map((day) => ({
    day,
    startHour: timeMatch[1],
    startMinute: timeMatch[2],
    endHour: timeMatch[3],
    endMinute: timeMatch[4],
  }));
}

export function validateHorario(horario: string | null): void {
  if (!horario) return;
  const trimmed = horario.trim();
  if (!trimmed) return;

  const segments: Array<{
    day: string;
    startHour: string;
    startMinute: string;
    endHour: string;
    endMinute: string;
  }> = [];

  for (const match of trimmed.matchAll(SLOT_SEGMENT_RE)) {
    segments.push({
      day: match[1],
      startHour: match[2].slice(0, 2),
      startMinute: match[2].slice(3, 5),
      endHour: match[3].slice(0, 2),
      endMinute: match[3].slice(3, 5),
    });
  }

  if (segments.length === 0) {
    segments.push(...parseLegacyHorarioSegments(trimmed));
  }

  if (segments.length === 0) {
    throw Object.assign(new Error("Horario inválido: día requerido"), { status: 400 });
  }

  for (const segment of segments) {
    if (!isValidWeekday(segment.day)) {
      throw Object.assign(new Error("Horario inválido"), { status: 400 });
    }
    validateTimeRange(
      segment.startHour,
      segment.startMinute,
      segment.endHour,
      segment.endMinute
    );
  }
}
