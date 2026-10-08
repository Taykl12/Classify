import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  LayoutGrid,
  List,
  Plus,
  Search,
} from "lucide-react";
import EventFormModal from "../components/calendar/EventFormModal";
import { AgendaView } from "../components/calendar/AgendaView";
import { DayEventsModal, EventDetailModal } from "../components/calendar/CalendarModals";
import { useAuth } from "../contexts/AuthContext";
import { apiFetchWithRetry, getAccessToken, isUnauthorizedError } from "../lib/api";
import type { CalendarEvent } from "../types/calendar";
import "../styles/Calendary.css";

interface CalendarCell {
  day: number;
  monthOffset: -1 | 0 | 1;
}

const WEEKDAYS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

function buildCalendarCells(year: number, month: number): CalendarCell[] {
  const firstDay = new Date(year, month, 1);
  let startWeekday = firstDay.getDay();
  if (startWeekday === 0) startWeekday = 7;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const leadingCount = startWeekday - 1;

  const cells: CalendarCell[] = [];
  for (let i = 0; i < leadingCount; i++) {
    cells.push({ day: daysInPrevMonth - leadingCount + i + 1, monthOffset: -1 });
  }
  for (let day = 1; day <= daysInMonth; day++) cells.push({ day, monthOffset: 0 });
  const totalCells = Math.ceil(cells.length / 7) * 7;
  let nextDay = 1;
  while (cells.length < totalCells) cells.push({ day: nextDay++, monthOffset: 1 });
  return cells;
}

function toDateKey(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function dateToKey(date: Date): string {
  return toDateKey(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount, 12);
}

function formatFullDate(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function CalendaryPage() {
  const { user, loading: authLoading } = useAuth();
  const [fechaActual, setFechaActual] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [focusedDate, setFocusedDate] = useState(() => new Date());
  const [items, setItems] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"month" | "agenda">("month");
  const [projectFilter, setProjectFilter] = useState("");
  const [query, setQuery] = useState("");
  const [dayModalKey, setDayModalKey] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState<{
    open: boolean;
    mode: "create" | "edit";
    date: string;
    event: CalendarEvent | null;
  }>({ open: false, mode: "create", date: dateToKey(new Date()), event: null });

  const cellRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const focusPendingRef = useRef(false);

  const fetchEvents = useCallback(async () => {
    if (authLoading || !user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetchWithRetry<CalendarEvent[]>("/api/calendar/events");
      setItems(data);
    } catch (e) {
      if (!isUnauthorizedError(e)) {
        setError(e instanceof Error ? e.message : "Error al cargar eventos");
      }
    } finally {
      setLoading(false);
    }
  }, [authLoading, user]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) map.set(item.projectId, item.projectName);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [items]);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (projectFilter && item.projectId !== projectFilter) return false;
      if (!needle) return true;
      return `${item.title} ${item.projectName} ${item.description}`
        .toLowerCase()
        .includes(needle);
    });
  }, [items, projectFilter, query]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const item of filteredItems) {
      const key = item.date;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [filteredItems]);

  const year = fechaActual.getFullYear();
  const month = fechaActual.getMonth();
  const monthName = fechaActual.toLocaleString("es-AR", { month: "long", year: "numeric" });
  const cells = useMemo(() => buildCalendarCells(year, month), [year, month]);
  const weeks = useMemo(() => {
    const result: CalendarCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) result.push(cells.slice(i, i + 7));
    return result;
  }, [cells]);

  const today = new Date();
  const todayKey = dateToKey(today);
  const focusedKey = dateToKey(focusedDate);

  useEffect(() => {
    if (!focusPendingRef.current) return;
    focusPendingRef.current = false;
    cellRefs.current[focusedKey]?.focus();
  }, [focusedKey, fechaActual]);

  const goMonth = useCallback(
    (offset: number) => {
      const next = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + offset, 1);
      const daysInNext = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      const day = Math.min(focusedDate.getDate(), daysInNext);
      setFechaActual(next);
      setFocusedDate(new Date(next.getFullYear(), next.getMonth(), day, 12));
    },
    [fechaActual, focusedDate]
  );

  const openCreate = useCallback((dateKey: string) => {
    setDayModalKey(null);
    setForm({ open: true, mode: "create", date: dateKey, event: null });
  }, []);

  const openDayOrCreate = useCallback(
    (dateKey: string, dayItems: CalendarEvent[]) => {
      if (dayItems.length > 0) setDayModalKey(dateKey);
      else openCreate(dateKey);
    },
    [openCreate]
  );

  const moveFocus = useCallback((next: Date) => {
    focusPendingRef.current = true;
    setFocusedDate(next);
    setFechaActual((prev) => {
      if (prev.getFullYear() === next.getFullYear() && prev.getMonth() === next.getMonth()) {
        return prev;
      }
      return new Date(next.getFullYear(), next.getMonth(), 1);
    });
  }, []);

  const handleGridKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const key = event.key;
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown", "Enter", " "].includes(key)) {
        return;
      }
      event.preventDefault();
      const iso = ((focusedDate.getDay() + 6) % 7) + 1;
      switch (key) {
        case "ArrowLeft":
          moveFocus(addDays(focusedDate, -1));
          break;
        case "ArrowRight":
          moveFocus(addDays(focusedDate, 1));
          break;
        case "ArrowUp":
          moveFocus(addDays(focusedDate, -7));
          break;
        case "ArrowDown":
          moveFocus(addDays(focusedDate, 7));
          break;
        case "Home":
          moveFocus(addDays(focusedDate, -(iso - 1)));
          break;
        case "End":
          moveFocus(addDays(focusedDate, 7 - iso));
          break;
        case "PageUp":
          moveFocus(new Date(focusedDate.getFullYear(), focusedDate.getMonth() - 1, focusedDate.getDate(), 12));
          break;
        case "PageDown":
          moveFocus(new Date(focusedDate.getFullYear(), focusedDate.getMonth() + 1, focusedDate.getDate(), 12));
          break;
        case "Enter":
        case " ": {
          const key2 = dateToKey(focusedDate);
          const dayItems = eventsByDate.get(key2) ?? [];
          openDayOrCreate(key2, dayItems);
          break;
        }
      }
    },
    [focusedDate, eventsByDate, moveFocus, openDayOrCreate]
  );

  async function handleDelete(item: CalendarEvent) {
    if (!window.confirm(`¿Eliminar el evento "${item.title}"?`)) return;
    try {
      await apiFetchWithRetry(`/api/calendar/events/${item.id}`, { method: "DELETE" });
      setDetailItem(null);
      await fetchEvents();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar el evento");
    }
  }

  async function downloadIcs() {
    try {
      const params = new URLSearchParams();
      if (projectFilter) params.set("projectId", projectFilter);
      if (query.trim()) params.set("q", query.trim());
      const token = getAccessToken();
      const res = await fetch(`/api/calendar/events/export.ics?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error("No se pudo exportar el calendario");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "classify.ics";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo exportar el calendario");
    }
  }

  const dayModalItems = dayModalKey ? eventsByDate.get(dayModalKey) ?? [] : [];

  return (
    <section className="calendary-page">
      <div className="calendar-container">
        <header className="calendar-header">
          <div className="calendar-header__left">
            <button
              type="button"
              className="calendar-btn calendar-btn--today"
              onClick={() => {
                const now = new Date();
                setFechaActual(new Date(now.getFullYear(), now.getMonth(), 1));
                setFocusedDate(now);
              }}
            >
              Hoy
            </button>
            <button
              type="button"
              className="calendar-btn calendar-btn--add"
              onClick={() => openCreate(todayKey)}
            >
              <Plus size={18} aria-hidden />
              Añadir evento
            </button>
            <button
              type="button"
              className="calendar-btn calendar-btn--today"
              onClick={() => void downloadIcs()}
            >
              <Download size={16} aria-hidden />
              Exportar .ics
            </button>
          </div>

          <div className="calendar-header__right">
            <div className="calendar-view-toggle" role="group" aria-label="Vista del calendario">
              <button
                type="button"
                className={`calendar-btn calendar-btn--nav${view === "month" ? " calendar-btn--active" : ""}`}
                onClick={() => setView("month")}
                aria-pressed={view === "month"}
                aria-label="Vista mensual"
              >
                <LayoutGrid size={18} aria-hidden />
              </button>
              <button
                type="button"
                className={`calendar-btn calendar-btn--nav${view === "agenda" ? " calendar-btn--active" : ""}`}
                onClick={() => setView("agenda")}
                aria-pressed={view === "agenda"}
                aria-label="Vista agenda"
              >
                <List size={18} aria-hidden />
              </button>
            </div>
            {view === "month" ? (
              <div className="month-controls">
                <button
                  type="button"
                  className="calendar-btn calendar-btn--nav"
                  onClick={() => goMonth(-1)}
                  aria-label="Mes anterior"
                >
                  <ChevronLeft size={22} aria-hidden />
                </button>
                <h2 id="calendary-title" className="calendar-title">
                  {monthName}
                </h2>
                <button
                  type="button"
                  className="calendar-btn calendar-btn--nav"
                  onClick={() => goMonth(1)}
                  aria-label="Mes siguiente"
                >
                  <ChevronRight size={22} aria-hidden />
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <div className="calendar-filters">
          <label className="calendar-filter">
            <Search size={16} aria-hidden />
            <span className="sr-only">Buscar eventos</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título o proyecto"
            />
          </label>
          <label className="calendar-filter">
            <span className="sr-only">Filtrar por proyecto</span>
            <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
              <option value="">Todos los proyectos</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? (
          <p className="calendar-error" role="alert">
            {error}
          </p>
        ) : null}

        {view === "agenda" ? (
          <div className="calendar-body">
            <AgendaView items={filteredItems} onSelectItem={setDetailItem} />
          </div>
        ) : (
          <div className="calendar-body">
            <div className="weekdays" role="row">
              {WEEKDAYS.map((dia) => (
                <div key={dia} role="columnheader">
                  {dia}
                </div>
              ))}
            </div>

            <div
              className="calendar-grid"
              role="grid"
              aria-label={`Calendario de ${monthName}`}
              onKeyDown={handleGridKeyDown}
            >
              {weeks.map((week, weekIndex) => (
                <div className="calendar-row" role="row" key={weekIndex}>
                  {week.map((celda, index) => {
                    const cellDate = new Date(year, month + celda.monthOffset, celda.day, 12);
                    const dateKey = dateToKey(cellDate);
                    const isOtherMonth = celda.monthOffset !== 0;
                    const dayItems = isOtherMonth ? [] : eventsByDate.get(dateKey) ?? [];
                    const esHoy = dateKey === todayKey;
                    const esFinDeSemana = index % 7 >= 5;
                    const dayClasses = [
                      "day-number",
                      isOtherMonth && "day-number--other-month",
                      esFinDeSemana && "day-number--weekend",
                      esHoy && "day-number--today",
                    ]
                      .filter(Boolean)
                      .join(" ");
                    const label = isOtherMonth
                      ? `${formatFullDate(cellDate)} (otro mes)`
                      : `${formatFullDate(cellDate)}, ${dayItems.length} ${
                          dayItems.length === 1 ? "evento" : "eventos"
                        }`;

                    return (
                      <div
                        key={dateKey}
                        role="gridcell"
                        tabIndex={dateKey === focusedKey ? 0 : -1}
                        className={`day-cell${isOtherMonth ? " day-cell--other-month" : ""}`}
                        aria-label={label}
                        aria-current={esHoy ? "date" : undefined}
                        ref={(el) => {
                          cellRefs.current[dateKey] = el;
                        }}
                        onClick={() => {
                          if (isOtherMonth) {
                            moveFocus(cellDate);
                            return;
                          }
                          openDayOrCreate(dateKey, dayItems);
                        }}
                      >
                        <span className={dayClasses}>{celda.day}</span>
                        {!loading && !isOtherMonth && dayItems.length > 0 ? (
                          <div className="day-events">
                            {dayItems.slice(0, 3).map((item) => (
                              <button
                                type="button"
                                key={item.id}
                                className={`day-event-dot${
                                  item.type === "task" ? " day-event-dot--task" : ""
                                }`}
                                title={`${item.title} - ${item.projectName}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDetailItem(item);
                                }}
                              >
                                {item.title}
                              </button>
                            ))}
                            {dayItems.length > 3 ? (
                              <span className="day-event-more">+{dayItems.length - 3} más</span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {dayModalKey ? (
        <DayEventsModal
          fecha={dayModalKey}
          items={dayModalItems}
          onClose={() => setDayModalKey(null)}
          onSelectItem={setDetailItem}
          onAddEvent={() => openCreate(dayModalKey)}
        />
      ) : null}

      {detailItem ? (
        <EventDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onEdit={(item) => {
            setDetailItem(null);
            setForm({ open: true, mode: "edit", date: item.date, event: item });
          }}
          onDelete={(item) => void handleDelete(item)}
        />
      ) : null}

      {form.open ? (
        <EventFormModal
          mode={form.mode}
          eventDate={form.date}
          event={form.event}
          onClose={() => setForm((prev) => ({ ...prev, open: false }))}
          onSaved={() => {
            setForm((prev) => ({ ...prev, open: false }));
            void fetchEvents();
          }}
        />
      ) : null}
    </section>
  );
}
