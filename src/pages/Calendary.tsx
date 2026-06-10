import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DashboardLayout } from "../components/layout/DashboardLayout";
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

export default function CalendaryPage() {
  const dias = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

  const [fechaActual, setFechaActual] = useState(new Date());

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
            <button
              type="button"
              className="calendar-btn calendar-btn--today"
              onClick={irAHoy}
            >
              Hoy
            </button>

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

                const dayClasses = [
                  "day-number",
                  celda.monthOffset !== 0 && "day-number--other-month",
                  esFinDeSemana && "day-number--weekend",
                  esHoy && "day-number--today",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <div className="day-cell" key={index}>
                    <span className={dayClasses}>{celda.day}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}
