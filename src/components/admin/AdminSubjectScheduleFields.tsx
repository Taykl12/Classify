import { Minus, Plus } from "lucide-react";
import {
  SCHEDULE_HOUR_OPTIONS,
  SCHEDULE_MINUTE_OPTIONS,
  SCHEDULE_WEEKDAY_OPTIONS,
  compareTimes,
  composeHorario,
  defaultScheduleEndTime,
  nextAvailableWeekday,
} from "../../lib/adminAcademic";
import { AdminTimePickerInput } from "./AdminTimePickerInput";

interface AdminSubjectScheduleFieldsProps {
  days: string[];
  startHour: string;
  startMinute: string;
  endHour: string;
  endMinute: string;
  onDaysChange: (days: string[]) => void;
  onStartHourChange: (hour: string) => void;
  onStartMinuteChange: (minute: string) => void;
  onEndHourChange: (hour: string) => void;
  onEndMinuteChange: (minute: string) => void;
}

export function AdminSubjectScheduleFields({
  days,
  startHour,
  startMinute,
  endHour,
  endMinute,
  onDaysChange,
  onStartHourChange,
  onStartMinuteChange,
  onEndHourChange,
  onEndMinuteChange,
}: AdminSubjectScheduleFieldsProps) {
  const canAddDay = days.length < SCHEDULE_WEEKDAY_OPTIONS.length;
  const preview = composeHorario(days, startHour, startMinute, endHour, endMinute);

  function updateDay(index: number, value: string) {
    const next = [...days];
    const duplicateIndex = next.findIndex((day, dayIndex) => dayIndex !== index && day === value);
    if (duplicateIndex >= 0) {
      next[duplicateIndex] = next[index];
    }
    next[index] = value;
    onDaysChange(next);
  }

  function removeDay(index: number) {
    if (days.length <= 1) return;
    onDaysChange(days.filter((_, dayIndex) => dayIndex !== index));
  }

  function addDay() {
    const nextDay = nextAvailableWeekday(days);
    if (!nextDay) return;
    onDaysChange([...days, nextDay]);
  }

  function handleStartChange(hour: string, minute: string) {
    onStartHourChange(hour);
    onStartMinuteChange(minute);
    if (compareTimes(hour, minute, endHour, endMinute) >= 0) {
      const adjusted = defaultScheduleEndTime(hour, minute);
      onEndHourChange(adjusted.hour);
      onEndMinuteChange(adjusted.minute);
    }
  }

  const endHourOptions = SCHEDULE_HOUR_OPTIONS.filter(
    (hour) => compareTimes(startHour, startMinute, hour, "00") < 0
  );

  const endMinuteOptions =
    endHour === startHour
      ? SCHEDULE_MINUTE_OPTIONS.filter(
          (minute) => compareTimes(startHour, startMinute, endHour, minute) < 0
        )
      : SCHEDULE_MINUTE_OPTIONS;

  function handleEndChange(hour: string, minute: string) {
    onEndHourChange(hour);
    onEndMinuteChange(minute);
  }

  return (
    <>
      <div className="admin-schedule-days">
        <span className="project-modal__label">Días</span>
        <div className="admin-schedule-days__list">
          {days.map((day, index) => (
            <div key={`${index}-${day}`} className="admin-schedule-days__row">
              <select
                className="project-modal__input"
                value={day}
                onChange={(e) => updateDay(index, e.target.value)}
                aria-label={`Día ${index + 1}`}
                required
              >
                {SCHEDULE_WEEKDAY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {days.length > 1 ? (
                <button
                  type="button"
                  className="admin-schedule-days__remove"
                  onClick={() => removeDay(index)}
                  aria-label={`Quitar ${day}`}
                >
                  <Minus size={16} aria-hidden />
                </button>
              ) : null}
            </div>
          ))}
          {canAddDay ? (
            <button
              type="button"
              className="admin-schedule-days__add"
              onClick={addDay}
              aria-label="Agregar día"
            >
              <Plus size={18} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      <div className="admin-schedule-range">
        <span className="project-modal__label">Horario</span>
        <div className="admin-schedule-range__inputs">
          <AdminTimePickerInput
            hour={startHour}
            minute={startMinute}
            onChange={handleStartChange}
            ariaLabel="Hora de inicio"
          />
          <span className="admin-schedule-range__sep" aria-hidden>
            —
          </span>
          <AdminTimePickerInput
            hour={endHour}
            minute={endMinute}
            hourOptions={endHourOptions.length > 0 ? endHourOptions : ["23"]}
            minuteOptions={endMinuteOptions.length > 0 ? endMinuteOptions : ["59"]}
            onChange={handleEndChange}
            ariaLabel="Hora de fin"
          />
        </div>
        <p className="admin-form__hint">Formato: HH:mm (ej: 16:00 - 17:00)</p>
      </div>

      {preview ? (
        <p className="admin-form__hint">
          Vista previa: <strong>{preview}</strong>
        </p>
      ) : null}
    </>
  );
}
