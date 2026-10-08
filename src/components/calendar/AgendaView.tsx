import { CalendarX, ListTodo } from "lucide-react";
import type { CalendarEvent } from "../../types/calendar";

interface AgendaViewProps {
  items: CalendarEvent[];
  onSelectItem: (item: CalendarEvent) => void;
}

function formatDay(fecha: string): string {
  const parsed = new Date(`${fecha}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return fecha;
  return parsed.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function timeLabel(item: CalendarEvent): string {
  if (item.type === "task") return "Vencimiento";
  if (!item.horaInicio) return "Todo el día";
  return item.horaFin ? `${item.horaInicio} – ${item.horaFin}` : item.horaInicio;
}

export function AgendaView({ items, onSelectItem }: AgendaViewProps) {
  if (items.length === 0) {
    return (
      <div className="calendar-agenda__empty" role="status">
        <CalendarX size={20} aria-hidden /> No hay eventos ni vencimientos para el filtro
        seleccionado.
      </div>
    );
  }

  const sorted = [...items].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.horaInicio ?? "").localeCompare(b.horaInicio ?? "");
  });

  const groups: Array<{ date: string; items: CalendarEvent[] }> = [];
  for (const item of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.date === item.date) last.items.push(item);
    else groups.push({ date: item.date, items: [item] });
  }

  return (
    <div className="calendar-agenda">
      {groups.map((group) => (
        <section key={group.date} className="calendar-agenda__group">
          <h3 className="calendar-agenda__date">{formatDay(group.date)}</h3>
          <ul className="calendar-agenda__list">
            {group.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`calendar-agenda__item calendar-agenda__item--${item.type}`}
                  onClick={() => onSelectItem(item)}
                >
                  <span className="calendar-agenda__time">{timeLabel(item)}</span>
                  <span className="calendar-agenda__body">
                    <strong>{item.title}</strong>
                    <span className="calendar-agenda__project">
                      {item.type === "task" ? (
                        <>
                          <ListTodo size={12} aria-hidden /> {item.projectName}
                        </>
                      ) : (
                        item.projectName
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
