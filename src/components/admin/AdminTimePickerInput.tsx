import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import {
  SCHEDULE_HOUR_OPTIONS,
  SCHEDULE_MINUTE_OPTIONS,
  composeTime,
} from "../../lib/adminAcademic";

interface AdminTimePickerInputProps {
  hour: string;
  minute: string;
  hourOptions?: readonly string[];
  minuteOptions?: readonly string[];
  onChange: (hour: string, minute: string) => void;
  ariaLabel: string;
}

export function AdminTimePickerInput({
  hour,
  minute,
  hourOptions = SCHEDULE_HOUR_OPTIONS,
  minuteOptions = SCHEDULE_MINUTE_OPTIONS,
  onChange,
  ariaLabel,
}: AdminTimePickerInputProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    hourListRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
    minuteListRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [open, hour, minute]);

  return (
    <div className="admin-time-picker" ref={rootRef}>
      <button
        type="button"
        className="admin-time-picker__trigger"
        onClick={() => setOpen((value) => !value)}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span>{composeTime(hour, minute)}</span>
        <Clock size={16} aria-hidden />
      </button>
      {open ? (
        <div className="admin-time-picker__panel" role="dialog" aria-label={ariaLabel}>
          <div
            className="admin-time-picker__column"
            ref={hourListRef}
            role="listbox"
            aria-label="Hora"
          >
            {hourOptions.map((option) => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={option === hour}
                className={`admin-time-picker__option${
                  option === hour ? " admin-time-picker__option--selected" : ""
                }`}
                onClick={() => onChange(option, minute)}
              >
                {option}
              </button>
            ))}
          </div>
          <div
            className="admin-time-picker__column"
            ref={minuteListRef}
            role="listbox"
            aria-label="Minutos"
          >
            {minuteOptions.map((option) => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={option === minute}
                className={`admin-time-picker__option${
                  option === minute ? " admin-time-picker__option--selected" : ""
                }`}
                onClick={() => onChange(hour, option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
