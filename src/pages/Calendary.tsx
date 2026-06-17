import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import EventFormModal from "../components/calendar/EventFormModal";
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

function getEventDateKey(dateStr: string): string {
  const plain = dateStr.split("T")[0] ?? dateStr;
  if (/^\d{4}-\d{2}-\d{2}$/.test(plain)) return plain;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return plain;
  return toDateKey(d.getFullYear(), d.getMonth(), d.getDate());
}

function priorityBadgeClass(priority?: string): string {
  switch (priority) {
    case "Alta":
      return "calendar-priority-badge calendar-priority-badge--alta";
    case "Baja":
      return "calendar-priority-badge calendar-priority-badge--baja";
    default:
      return "calendar-priority-badge calendar-priority-badge--media";
  }
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
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventFormDate, setEventFormDate] = useState<string | null>(null);

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
    fetchEvents();
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
                onClick={() => {
                  setEventFormDate(toDateKey(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
                  setShowEventForm(true);
                }}
              >
                <Plus size={18} aria-hidden />
                Añadir evento
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
                        setEventFormDate(dateKey);
                        setShowEventForm(true);
                      }
                    }}
                  >
                    <span className={dayClasses}>{celda.day}</span>
                    {loading ? null : dayEvents.length > 0 && celda.monthOffset === 0 ? (
                      <div className="day-events">
                        {dayEvents.slice(0, 3).map((ev) => (
                          <button
                            type="button"
                            key={ev.id}
                            className="day-event-dot"
                            title={`${ev.title} - ${ev.projectName}${ev.priority ? ` (${ev.priority})` : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDateKey(dateKey);
                              setSelectedDayEvents(dayEvents);
                            }}
                          >
                            {ev.title}
                          </button>
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
                      <div className="day-events-modal__item-header">
                        <strong>{ev.title}</strong>
                        {ev.priority ? (
                          <span className={priorityBadgeClass(ev.priority)}>{ev.priority}</span>
                        ) : null}
                      </div>
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
                        setEventFormDate(selectedDateKey);
                        setShowEventForm(true);
                      }}
                    >
                      <Plus size={18} aria-hidden />
                      Añadir evento
                    </button>
                  </div>
              </div>
            </div>
          ) : null}

          {showEventForm && eventFormDate ? (
            <EventFormModal
              eventDate={eventFormDate}
              onClose={() => { setShowEventForm(false); setEventFormDate(null); }}
              onEventCreated={() => {
                setShowEventForm(false);
                setEventFormDate(null);
                fetchEvents();
              }}
            />
          ) : null}
        </div>
      </section>
    </DashboardLayout>
  );
}
