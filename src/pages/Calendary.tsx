import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import TaskFormModal from "../components/calendar/TaskFormModal";
import { useAuth } from "../contexts/AuthContext";
import { apiFetchWithRetry, isUnauthorizedError } from "../lib/api";
import type { CalendarEvent } from "../types/calendar";
import "../styles/Calendary.css";

interface CalendarCell {
  day: number;
  monthOffset: -1 | 0 | 1;
}

function buildCalendarCells(year: number, month: number): CalendarCell[] {
  const firstDay = new Date(year, month, 1);
  let startWeekday = firstDay.getDay();
  if (startWeekday === 0) startWeekday = 7;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const leadingCount = startWeekday - 1;

  const cells: CalendarCell[] = [];

  for (let i = 0; i < leadingCount; i++) {
    cells.push({
      day: daysInPrevMonth - leadingCount + i + 1,
      monthOffset: -1,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, monthOffset: 0 });
  }

  const totalCells = Math.ceil(cells.length / 7) * 7;
  let nextDay = 1;
  while (cells.length < totalCells) {
    cells.push({ day: nextDay++, monthOffset: 1 });
  }

  return cells;
}

function toDateKey(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function getEventDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.split("T")[0] ?? iso;
  return toDateKey(d.getFullYear(), d.getMonth(), d.getDate());
}

export default function CalendaryPage() {
  const dias = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

  const { user, loading: authLoading } = useAuth();
  const [fechaActual, setFechaActual] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState<CalendarEvent[] | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskFormDate, setTaskFormDate] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (authLoading || !user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetchWithRetry<CalendarEvent[]>("/api/calendar/events");
      setEvents(data);
    } catch (e) {
      if (!isUnauthorizedError(e)) {
        setError(e instanceof Error ? e.message : "Error al cargar eventos");
      }
    } finally {
      setLoading(false);
    }
  }, [authLoading, user]);

  useEffect(() => {
    let cancelled = false;
    fetchEvents().then(() => { /* noop */ });
    return () => { cancelled = true; };
  }, [fetchEvents]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = getEventDateKey(ev.date);
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const irMesAnterior = () => {
    setFechaActual(
      new Date(fechaActual.getFullYear(), fechaActual.getMonth() - 1, 1),
    );
  };

  const irMesSiguiente = () => {
    setFechaActual(
      new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 1),
    );
  };

  const irAHoy = () => {
    setFechaActual(new Date());
  };

  const nombreMes = fechaActual.toLocaleString("es-AR", {
    month: "long",
    year: "numeric",
  });

  const año = fechaActual.getFullYear();
  const mes = fechaActual.getMonth();
  const celdas = buildCalendarCells(año, mes);
  const hoy = new Date();

  return (
    <DashboardLayout>
      <section className="calendary-page">
        <div className="calendar-container">
          <header className="calendar-header">
            <div className="calendar-header__left">
              <button
                type="button"
                className="calendar-btn calendar-btn--today"
                onClick={irAHoy}
              >
                Hoy
              </button>
              <button
                type="button"
                className="calendar-btn calendar-btn--add"
                onClick={() => { setTaskFormDate(null); setShowTaskForm(true); }}
              >
                <Plus size={18} aria-hidden />
                Nueva tarea
              </button>
            </div>

            <div className="month-controls">
              <button
                type="button"
                className="calendar-btn calendar-btn--nav"
                onClick={irMesAnterior}
                aria-label="Mes anterior"
              >
                <ChevronLeft size={22} aria-hidden />
              </button>

              <h2 id="calendary-title" className="calendar-title">
                {nombreMes}
              </h2>

              <button
                type="button"
                className="calendar-btn calendar-btn--nav"
                onClick={irMesSiguiente}
                aria-label="Mes siguiente"
              >
                <ChevronRight size={22} aria-hidden />
              </button>
            </div>
          </header>

          {error ? <p className="calendar-error" role="alert">{error}</p> : null}

          <div className="calendar-body">
            <div className="weekdays">
              {dias.map((dia) => (
                <div key={dia}>{dia}</div>
              ))}
            </div>

            <div className="calendar-grid">
              {celdas.map((celda, index) => {
                const esHoy =
                  celda.monthOffset === 0 &&
                  celda.day === hoy.getDate() &&
                  mes === hoy.getMonth() &&
                  año === hoy.getFullYear();

                const esFinDeSemana = index % 7 >= 5;

                const cellDate = new Date(año, mes + celda.monthOffset, celda.day);
                const dateKey = toDateKey(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate());

                const dayEvents = eventsByDate.get(dateKey) ?? [];

                const dayClasses = [
                  "day-number",
                  celda.monthOffset !== 0 && "day-number--other-month",
                  esFinDeSemana && "day-number--weekend",
                  esHoy && "day-number--today",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <button
                    type="button"
                    className="day-cell"
                    key={index}
                    onClick={() => {
                      setSelectedDateKey(dateKey);
                      if (dayEvents.length > 0) {
                        setSelectedDayEvents(dayEvents);
                      } else {
                        setTaskFormDate(dateKey);
                        setShowTaskForm(true);
                      }
                    }}
                  >
                    <span className={dayClasses}>{celda.day}</span>
                    {loading ? null : dayEvents.length > 0 && celda.monthOffset === 0 ? (
                      <div className="day-events">
                        {dayEvents.slice(0, 3).map((ev) => (
                          <span
                            key={ev.id}
                            className="day-event-dot"
                            title={`${ev.title} - ${ev.projectName}`}
                          >
                            {ev.title}
                          </span>
                        ))}
                        {dayEvents.length > 3 ? (
                          <span className="day-event-more">+{dayEvents.length - 3} más</span>
                        ) : null}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedDayEvents ? (
            <div className="day-events-overlay" onClick={() => { setSelectedDayEvents(null); setSelectedDateKey(null); }}>
              <div className="day-events-modal" onClick={(e) => e.stopPropagation()}>
                <div className="day-events-modal__header">
                  <h3>Eventos del día</h3>
                  <button
                    type="button"
                    className="calendar-btn calendar-btn--nav"
                    onClick={() => { setSelectedDayEvents(null); setSelectedDateKey(null); }}
                    aria-label="Cerrar"
                  >
                    ✕
                  </button>
                </div>
                <ul className="day-events-modal__list">
                  {selectedDayEvents.map((ev) => (
                    <li key={ev.id} className="day-events-modal__item">
                      <strong>{ev.title}</strong>
                      <span className="day-events-modal__project">{ev.projectName}</span>
                      {ev.description ? (
                        <p className="day-events-modal__desc">{ev.description}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
                  <div className="day-events-modal__footer">
                    <button
                      type="button"
                      className="calendar-btn calendar-btn--add"
                      onClick={() => {
                        setSelectedDayEvents(null);
                        setTaskFormDate(selectedDateKey);
                        setShowTaskForm(true);
                      }}
                    >
                      <Plus size={18} aria-hidden />
                      Agregar tarea
                    </button>
                  </div>
              </div>
            </div>
          ) : null}

          {showTaskForm ? (
            <TaskFormModal
              defaultDate={taskFormDate}
              onClose={() => { setShowTaskForm(false); setTaskFormDate(null); }}
              onTaskCreated={() => {
                setShowTaskForm(false);
                setTaskFormDate(null);
                fetchEvents();
              }}
            />
          ) : null}
        </div>
      </section>
    </DashboardLayout>
  );
}
