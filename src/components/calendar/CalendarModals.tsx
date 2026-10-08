import { CalendarClock, ListTodo, Pencil, Trash2 } from "lucide-react";
import { useModalEscape } from "../../hooks/useModalEscape";
import type { CalendarEvent } from "../../types/calendar";

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

function formatDate(fecha: string): string {
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
  if (!item.horaInicio) return "Todo el día";
  return item.horaFin ? `${item.horaInicio} – ${item.horaFin}` : item.horaInicio;
}

interface DayEventsModalProps {
  fecha: string;
  items: CalendarEvent[];
  onClose: () => void;
  onSelectItem: (item: CalendarEvent) => void;
  onAddEvent: () => void;
}

export function DayEventsModal({
  fecha,
  items,
  onClose,
  onSelectItem,
  onAddEvent,
}: DayEventsModalProps) {
  useModalEscape(true, onClose);
  return (
    <div className="day-events-overlay" onClick={onClose}>
      <div
        className="day-events-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Eventos del ${formatDate(fecha)}`}
      >
        <div className="day-events-modal__header">
          <h3>Eventos del día</h3>
          <button
            type="button"
            className="calendar-btn calendar-btn--nav"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <p className="day-events-modal__date">{formatDate(fecha)}</p>
        <ul className="day-events-modal__list">
          {items.map((item) => (
            <li key={item.id} className="day-events-modal__item">
              <button
                type="button"
                className="day-events-modal__item-btn"
                onClick={() => onSelectItem(item)}
              >
                <span className="day-events-modal__item-header">
                  <strong>{item.title}</strong>
                  {item.type === "task" ? (
                    <span className="calendar-type-badge calendar-type-badge--task">
                      <ListTodo size={12} aria-hidden /> Vencimiento
                    </span>
                  ) : item.priority ? (
                    <span className={priorityBadgeClass(item.priority)}>{item.priority}</span>
                  ) : null}
                </span>
                <span className="day-events-modal__project">
                  {item.projectName}
                  {item.type === "event" ? ` · ${timeLabel(item)}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="day-events-modal__footer">
          <button type="button" className="calendar-btn calendar-btn--add" onClick={onAddEvent}>
            <CalendarClock size={18} aria-hidden />
            Añadir evento
          </button>
        </div>
      </div>
    </div>
  );
}

interface EventDetailModalProps {
  item: CalendarEvent;
  onClose: () => void;
  onEdit: (item: CalendarEvent) => void;
  onDelete: (item: CalendarEvent) => void;
}

export function EventDetailModal({ item, onClose, onEdit, onDelete }: EventDetailModalProps) {
  useModalEscape(true, onClose);
  const isTask = item.type === "task";
  const canModify = !item.readOnly && item.canEdit;

  return (
    <div className="day-events-overlay" onClick={onClose}>
      <div
        className="day-events-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de ${item.title}`}
      >
        <div className="day-events-modal__header">
          <h3>{isTask ? "Vencimiento de tarea" : "Detalle del evento"}</h3>
          <button
            type="button"
            className="calendar-btn calendar-btn--nav"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className="calendar-event-detail">
          <h4 className="calendar-event-detail__title">{item.title}</h4>
          <div className="calendar-event-detail__badges">
            {isTask ? (
              <span className="calendar-type-badge calendar-type-badge--task">
                <ListTodo size={12} aria-hidden /> Vencimiento de tarea
              </span>
            ) : item.priority ? (
              <span className={priorityBadgeClass(item.priority)}>{item.priority}</span>
            ) : null}
            {item.estado ? (
              <span className="calendar-type-badge calendar-type-badge--state">{item.estado}</span>
            ) : null}
          </div>
          <dl className="calendar-event-detail__facts">
            <div>
              <dt>Proyecto</dt>
              <dd>{item.projectName}</dd>
            </div>
            <div>
              <dt>Fecha</dt>
              <dd>{formatDate(item.date)}</dd>
            </div>
            <div>
              <dt>Hora</dt>
              <dd>{isTask ? "—" : timeLabel(item)}</dd>
            </div>
          </dl>
          {item.description ? (
            <p className="calendar-event-detail__desc">{item.description}</p>
          ) : null}
          {isTask ? (
            <p className="calendar-event-detail__note">
              Este vencimiento proviene de una tarea del proyecto; se administra desde el tablero
              de tareas.
            </p>
          ) : null}
          {!canModify && !isTask ? (
            <p className="calendar-event-detail__note">
              No tenés permiso para editar o eliminar este evento.
            </p>
          ) : null}
        </div>
        <div className="day-events-modal__footer">
          <button type="button" className="calendar-btn calendar-btn--today" onClick={onClose}>
            Cerrar
          </button>
          {canModify ? (
            <>
              <button
                type="button"
                className="calendar-btn calendar-btn--today"
                onClick={() => onEdit(item)}
              >
                <Pencil size={16} aria-hidden /> Editar
              </button>
              <button
                type="button"
                className="calendar-btn calendar-btn--danger"
                onClick={() => onDelete(item)}
              >
                <Trash2 size={16} aria-hidden /> Eliminar
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
