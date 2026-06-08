import {useState} from "react";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import "../styles/Calendary.css";

export default function CalendaryPage() {
  const dias = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

  const [fechaActual, setFechaActual] = useState(new Date());

  const irMesAnterior = () => {
    setFechaActual(
        new Date(
            fechaActual.getFullYear(),
            fechaActual.getMonth() - 1,
            1
        )
    );
  };

  const irMesSiguiente = () => {
    setFechaActual(
        new Date(
            fechaActual.getFullYear(),
            fechaActual.getMonth() + 1,
            1
        )
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

  const primerDiaMes = new Date (año, mes, 1);

  let primerDiaSemana = primerDiaMes.getDay();

  if (primerDiaSemana === 0) {
    primerDiaSemana = 7;
  }

  const diasDelMes = new Date(año, mes + 1, 0).getDate();

  const celdas: (number | null) [] = [];

  for (let i = 1; i < primerDiaSemana; i++) {
    celdas.push(null);
  }

  for (let dia = 1; dia <= diasDelMes; dia++){
    celdas.push(dia);
  }

  while (celdas.length <42){
    celdas.push(null);
  }

  const hoy = new Date();

  return (
    <DashboardLayout>
      <section className="calendary-page">
        <div className="calendar-container">
          <header className="calendar-header">
            <button onClick={irAHoy}>
                Hoy
            </button>

            <div className="month-controls">
              <button onClick={irMesAnterior}>{"<"}</button>

              <h2 id="calendary-title">{nombreMes}</h2>

              <button onClick={irMesSiguiente}>{">"}</button>
            </div>
            </header>

            <div className="weekdays">
            {dias.map((dia) => (
              <div key={dia}>{dia}</div>
            ))}
            </div>

          <div className="calendar-grid">
            {celdas.map((dia, index) => {
                const esHoy =
                    dia !== null &&
                    dia === hoy.getDate() &&
                    mes === hoy.getMonth() &&
                    año === hoy.getFullYear();
                
                return (
                    <div className="day-cell" key = {index}>
                        {dia !== null && (
                            <span className= {esHoy ? "day-number today" : "day-number"}>
                                {dia}
                            </span>
                        )}
                    </div>
                );
        })}

        </div>

        </div>
      </section>
    </DashboardLayout>
  );
}

