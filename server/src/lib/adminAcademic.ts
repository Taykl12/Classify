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

function parseDaysPart(dayPart: string): string[] {
  const trimmed = dayPart.trim();
  if (!trimmed) return [];

  if (trimmed.includes(",")) {
    return trimmed
      .split(",")
      .map((day) => day.trim())
      .filter(isValidWeekday);
  }

  return isValidWeekday(trimmed) ? [trimmed] : [];
}

export function validateHorario(horario: string | null): void {
  if (!horario) return;
  const trimmed = horario.trim();
  if (!trimmed) return;

  const timeMatch = trimmed.match(/\b(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})\s*$/);
  if (!timeMatch || timeMatch.index === undefined) {
    throw Object.assign(new Error("Horario inválido"), { status: 400 });
  }

  const startHour = timeMatch[1];
  const startMinute = timeMatch[2];
  const endHour = timeMatch[3];
  const endMinute = timeMatch[4];
  const days = parseDaysPart(trimmed.slice(0, timeMatch.index));

  if (days.length === 0) {
    throw Object.assign(new Error("Horario inválido: día requerido"), { status: 400 });
  }

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
