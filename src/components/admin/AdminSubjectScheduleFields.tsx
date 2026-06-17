import { Minus, Plus } from "lucide-react";
import type { ScheduleSlot } from "../../lib/adminAcademic";
import {
  SCHEDULE_HOUR_OPTIONS,
  SCHEDULE_MINUTE_OPTIONS,
  SCHEDULE_WEEKDAY_OPTIONS,
  compareTimes,
  composeHorario,
  defaultScheduleEndTime,
  emptyScheduleSlot,
  nextAvailableWeekdayFromSlots,
  updateScheduleSlot,
} from "../../lib/adminAcademic";
import { AdminTimePickerInput } from "./AdminTimePickerInput";

interface AdminSubjectScheduleFieldsProps {
  slots: ScheduleSlot[];
  onSlotsChange: (slots: ScheduleSlot[]) => void;
}

function endOptionsForSlot(slot: ScheduleSlot) {
  const endHourOptions = SCHEDULE_HOUR_OPTIONS.filter(
    (hour) => compareTimes(slot.startHour, slot.startMinute, hour, "00") < 0
  );
  const endMinuteOptions =
    slot.endHour === slot.startHour
      ? SCHEDULE_MINUTE_OPTIONS.filter(
          (minute) =>
            compareTimes(slot.startHour, slot.startMinute, slot.endHour, minute) < 0
        )
      : SCHEDULE_MINUTE_OPTIONS;
  return {
    endHourOptions: endHourOptions.length > 0 ? endHourOptions : ["23"],
    endMinuteOptions: endMinuteOptions.length > 0 ? endMinuteOptions : ["59"],
  };
}

export function AdminSubjectScheduleFields({
  slots,
  onSlotsChange,
}: AdminSubjectScheduleFieldsProps) {
  const canAddDay = slots.length < SCHEDULE_WEEKDAY_OPTIONS.length;
  const preview = composeHorario(slots);

  function updateDay(index: number, day: string) {
    const next = [...slots];
    const duplicateIndex = next.findIndex(
      (slot, slotIndex) => slotIndex !== index && slot.day === day
    );
    if (duplicateIndex >= 0) {
      next[duplicateIndex] = { ...next[duplicateIndex], day: next[index].day };
    }
    onSlotsChange(updateScheduleSlot(next, index, { day }));
  }

  function removeSlot(index: number) {
    if (slots.length <= 1) return;
    onSlotsChange(slots.filter((_, slotIndex) => slotIndex !== index));
  }

  function addSlot() {
    const nextDay = nextAvailableWeekdayFromSlots(slots);
    if (!nextDay) return;
    onSlotsChange([...slots, emptyScheduleSlot(nextDay)]);
  }

  function handleStartChange(index: number, hour: string, minute: string) {
    const slot = slots[index];
    let patch: Partial<ScheduleSlot> = { startHour: hour, startMinute: minute };
    if (compareTimes(hour, minute, slot.endHour, slot.endMinute) >= 0) {
      const adjusted = defaultScheduleEndTime(hour, minute);
      patch = { ...patch, endHour: adjusted.hour, endMinute: adjusted.minute };
    }
    onSlotsChange(updateScheduleSlot(slots, index, patch));
  }

  function handleEndChange(index: number, hour: string, minute: string) {
    onSlotsChange(updateScheduleSlot(slots, index, { endHour: hour, endMinute: minute }));
  }

  return (
    <>
      <div className="admin-schedule-days">
        <span className="project-modal__label">Días y horarios</span>
        <div className="admin-schedule-days__list">
          {slots.map((slot, index) => {
            const { endHourOptions, endMinuteOptions } = endOptionsForSlot(slot);
            return (
              <div key={`${index}-${slot.day}`} className="admin-schedule-slot">
                <div className="admin-schedule-days__row">
                  <select
                    className="project-modal__input"
                    value={slot.day}
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
                  {slots.length > 1 ? (
                    <button
                      type="button"
                      className="admin-schedule-days__remove"
                      onClick={() => removeSlot(index)}
                      aria-label={`Quitar ${slot.day}`}
                    >
                      <Minus size={16} aria-hidden />
                    </button>
                  ) : null}
                </div>
                <div className="admin-schedule-range__inputs">
                  <AdminTimePickerInput
                    hour={slot.startHour}
                    minute={slot.startMinute}
                    onChange={(hour, minute) => handleStartChange(index, hour, minute)}
                    ariaLabel={`Hora de inicio para ${slot.day}`}
                  />
                  <span className="admin-schedule-range__sep" aria-hidden>
                    —
                  </span>
                  <AdminTimePickerInput
                    hour={slot.endHour}
                    minute={slot.endMinute}
                    hourOptions={endHourOptions}
                    minuteOptions={endMinuteOptions}
                    onChange={(hour, minute) => handleEndChange(index, hour, minute)}
                    ariaLabel={`Hora de fin para ${slot.day}`}
                  />
                </div>
              </div>
            );
          })}
          {canAddDay ? (
            <button
              type="button"
              className="admin-schedule-days__add"
              onClick={addSlot}
              aria-label="Agregar día"
            >
              <Plus size={18} aria-hidden />
            </button>
          ) : null}
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
