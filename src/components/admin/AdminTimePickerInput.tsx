import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

interface PanelCoords {
  top: number;
  left: number;
  width: number;
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
  const [coords, setCoords] = useState<PanelCoords | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  // El panel se renderiza en un portal para no quedar recortado por el
  // `overflow: hidden` del diálogo del modal.
  useEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setCoords({
        top: rect.bottom + 6,
        left: rect.left,
        width: Math.max(rect.width, 180),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
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
        ref={triggerRef}
        className="admin-time-picker__trigger"
        onClick={() => setOpen((value) => !value)}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span>{composeTime(hour, minute)}</span>
        <Clock size={16} aria-hidden />
      </button>
      {open && coords
        ? createPortal(
            <div
              ref={panelRef}
              className="admin-time-picker__panel admin-time-picker__panel--floating"
              style={{ top: coords.top, left: coords.left, width: coords.width }}
              role="dialog"
              aria-label={ariaLabel}
            >
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
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
