export const YEAR_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

export const DIVISION_COUNT_BY_YEAR: Record<number, number> = {
  1: 7,
  2: 5,
  3: 4,
  4: 4,
  5: 4,
  6: 4,
};

export const SUPERIOR_ORIENTATION_OPTIONS = ["G.A.O", "I.P.P", "T.E.P"] as const;

export const SCHEDULE_WEEKDAY_OPTIONS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

export const SCHEDULE_HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) =>
  String(index).padStart(2, "0")
);

export const SCHEDULE_MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0")
);

export type ScheduleWeekday = (typeof SCHEDULE_WEEKDAY_OPTIONS)[number];

const LEGACY_DAY_GROUPS: Record<string, readonly ScheduleWeekday[]> = {
  "Lunes a Viernes": ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"],
  "Lun y Vie": ["Lunes", "Viernes"],
  "Mar y Jue": ["Martes", "Jueves"],
};

export function isSuperiorYear(year: number): boolean {
  return year >= 3;
}

export function displayYearForInternalYear(year: number): number {
  return year <= 2 ? year : year - 2;
}

export function cycleTypeForYear(year: number): "Ciclo Basico" | "Ciclo Superior" {
  return year <= 2 ? "Ciclo Basico" : "Ciclo Superior";
}

export function yearSelectLabel(year: number): string {
  const displayYear = displayYearForInternalYear(year);
  const cycle = cycleTypeForYear(year);
  return cycle === "Ciclo Basico"
    ? `${displayYear}° — Ciclo Básico`
    : `${displayYear}° — Ciclo Superior`;
}

export function normalizeSpecialty(value: string): string {
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

export function courseCycleLabel(year: number, specialty: string): string {
  if (!isSuperiorYear(year)) return "Ciclo Básico";
  return specialtyForCourse(year, specialty);
}

export function composeCoursePreview(
  year: number,
  division: string,
  specialty: string
): string {
  const displayYear = displayYearForInternalYear(year);
  return `${displayYear}° ${division} ${specialtyForCourse(year, specialty)}`;
}

export function isScheduleWeekday(value: string): value is ScheduleWeekday {
  return (SCHEDULE_WEEKDAY_OPTIONS as readonly string[]).includes(value);
}

export function nextAvailableWeekday(days: string[]): ScheduleWeekday | null {
  return SCHEDULE_WEEKDAY_OPTIONS.find((day) => !days.includes(day)) ?? null;
}

export function composeTime(hour: string, minute: string): string {
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

export function parseTime(time: string): { hour: string; minute: string } {
  const [hour = "18", minute = "30"] = time.split(":");
  const normalizedHour = hour.padStart(2, "0");
  const normalizedMinute = minute.padStart(2, "0");
  return {
    hour: SCHEDULE_HOUR_OPTIONS.includes(normalizedHour) ? normalizedHour : "18",
    minute: (SCHEDULE_MINUTE_OPTIONS as readonly string[]).includes(normalizedMinute)
      ? normalizedMinute
      : "00",
  };
}

export function compareTimes(
  hourA: string,
  minuteA: string,
  hourB: string,
  minuteB: string
): number {
  const a = composeTime(hourA, minuteA);
  const b = composeTime(hourB, minuteB);
  return a.localeCompare(b);
}

export function defaultScheduleEndTime(
  startHour: string,
  startMinute: string
): { hour: string; minute: string } {
  const start = parseTime(composeTime(startHour, startMinute));
  for (const hour of SCHEDULE_HOUR_OPTIONS) {
    for (const minute of SCHEDULE_MINUTE_OPTIONS) {
      if (compareTimes(start.hour, start.minute, hour, minute) < 0) {
        return { hour, minute };
      }
    }
  }
  return { hour: "23", minute: "59" };
}

export interface ParsedHorario {
  days: string[];
  startHour: string;
  startMinute: string;
  endHour: string;
  endMinute: string;
}

function parseDaysPart(dayPart: string): string[] {
  const trimmed = dayPart.trim();
  if (!trimmed) return ["Lunes"];

  const legacy = LEGACY_DAY_GROUPS[trimmed];
  if (legacy) return [...legacy];

  if (trimmed.includes(",")) {
    const parsed = trimmed
      .split(",")
      .map((day) => day.trim())
      .filter(isScheduleWeekday);
    if (parsed.length > 0) return parsed;
  }

  if (isScheduleWeekday(trimmed)) return [trimmed];

  const legacyMatch = Object.entries(LEGACY_DAY_GROUPS).find(([label]) =>
    trimmed.includes(label)
  );
  if (legacyMatch) return [...legacyMatch[1]];

  return ["Lunes"];
}

export function composeHorario(
  days: string[],
  startHour: string,
  startMinute: string,
  endHour: string,
  endMinute: string
): string {
  const uniqueDays = [...new Set(days.filter(isScheduleWeekday))];
  if (uniqueDays.length === 0) return "";
  const start = composeTime(startHour, startMinute);
  const end = composeTime(endHour, endMinute);
  return `${uniqueDays.join(", ")} ${start} - ${end}`;
}

export function emptyParsedHorario(): ParsedHorario {
  return {
    days: ["Lunes"],
    startHour: "16",
    startMinute: "00",
    endHour: "17",
    endMinute: "00",
  };
}

export function parseHorario(horario: string): ParsedHorario {
  const defaults = emptyParsedHorario();
  const trimmed = horario.trim();
  if (!trimmed) return defaults;

  const timeMatch = trimmed.match(/\b(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\s*$/);
  if (!timeMatch || timeMatch.index === undefined) return defaults;

  const start = parseTime(timeMatch[1]);
  const end = parseTime(timeMatch[2]);
  const days = parseDaysPart(trimmed.slice(0, timeMatch.index));

  if (compareTimes(start.hour, start.minute, end.hour, end.minute) >= 0) {
    const adjustedEnd = defaultScheduleEndTime(start.hour, start.minute);
    return {
      days,
      startHour: start.hour,
      startMinute: start.minute,
      endHour: adjustedEnd.hour,
      endMinute: adjustedEnd.minute,
    };
  }

  return {
    days,
    startHour: start.hour,
    startMinute: start.minute,
    endHour: end.hour,
    endMinute: end.minute,
  };
}

export function divisionLabel(index: number): string {
  return `${index}ª`;
}

export function divisionOptionsForYear(year: number): string[] {
  const count = DIVISION_COUNT_BY_YEAR[year] ?? 4;
  return Array.from({ length: count }, (_, index) => divisionLabel(index + 1));
}

export function normalizeDivisionForYear(division: string, year: number): string {
  const options = divisionOptionsForYear(year);
  return options.includes(division) ? division : options[0];
}
