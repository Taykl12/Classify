import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Fingerprint, Search, Settings, UserX } from "lucide-react";
import { TeacherAttendanceConfigModal } from "../../components/admin/TeacherAttendanceConfigModal";
import { TeacherAttendanceDetailModal } from "../../components/admin/TeacherAttendanceDetailModal";
import { TeacherAttendanceCorrectionModal } from "../../components/admin/TeacherAttendanceCorrectionModal";
import { apiFetchWithRetry } from "../../lib/api";
import { formatAttendanceDate, todayIsoDate } from "../../lib/professorDisplay";
import type {
  TeacherAttendanceDisplayEstado,
  TeacherAttendanceEstado,
  TeacherAttendanceRecord,
  TeacherAttendanceResponse,
} from "../../types/admin";
import "../../styles/admin.css";

const STATUS_FILTERS: TeacherAttendanceDisplayEstado[] = [
  "Presente",
  "Tardanza",
  "Ausente",
  "Sin marcar",
  "Justificado",
];

const BADGE_CLASS: Record<TeacherAttendanceDisplayEstado, string> = {
  Presente: "teacher-attendance-badge--presente",
  Tardanza: "teacher-attendance-badge--tardanza",
  Ausente: "teacher-attendance-badge--ausente",
  Justificado: "teacher-attendance-badge--justificado",
  "Sin marcar": "teacher-attendance-badge--sinmarcar",
  "No corresponde": "teacher-attendance-badge--nocorresponde",
};

interface CorrectionTarget {
  userId: string;
  professorName: string;
  fecha: string;
  inicial: {
    estado: TeacherAttendanceEstado;
    horaEntrada: string | null;
    observaciones: string;
  };
}

function professorName(record: TeacherAttendanceRecord): string {
  return [record.firstName, record.lastName].filter(Boolean).join(" ") || "Sin nombre";
}

function storedEstado(estado: TeacherAttendanceDisplayEstado): TeacherAttendanceEstado {
  return estado === "Sin marcar" || estado === "No corresponde" ? "Presente" : estado;
}

export default function AdminTeacherAttendancePage() {
  const [fecha, setFecha] = useState<string>(() => todayIsoDate());
  const [data, setData] = useState<TeacherAttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<TeacherAttendanceDisplayEstado | "">("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [correction, setCorrection] = useState<CorrectionTarget | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  const load = useCallback(async () => {
    const response = await apiFetchWithRetry<TeacherAttendanceResponse>(
      `/api/admin/asistencia-profesores?fecha=${fecha}`
    );
    setData(response);
  }, [fecha]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    load()
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load, refreshToken]);

  const visibleRecords = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    return data.registros.filter((record) => {
      if (estadoFilter && record.estado !== estadoFilter) return false;
      if (!needle) return true;
      return [record.firstName, record.lastName, record.email]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [data, query, estadoFilter]);

  const handleCorrected = useCallback(() => {
    setRefreshToken((value) => value + 1);
  }, []);

  const openCorrection = useCallback((record: TeacherAttendanceRecord) => {
    setCorrection({
      userId: record.userId,
      professorName: professorName(record),
      fecha: record.fecha,
      inicial: {
        estado: storedEstado(record.estado),
        horaEntrada: record.horaEntrada,
        observaciones: record.observaciones,
      },
    });
  }, []);

  const resumen = data?.resumen;

  return (
    <>
      <header className="admin-hero">
        <Fingerprint size={52} strokeWidth={2.25} className="admin-hero__icon" aria-hidden />
        <div>
          <p className="admin-hero__eyebrow">Administración</p>
          <h1 className="admin-hero__title">Asistencia de Profesores</h1>
        </div>
      </header>

      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <h2 className="dashboard-panel__title">Resumen del día</h2>
          <p className="dashboard-panel__subtitle">
            {data ? formatAttendanceDate(data.fecha) : "Cargando…"}
            {data ? ` · Horario esperado ${data.horaEntradaEsperada}` : ""}
          </p>
        </div>

        {error ? (
          <p className="dashboard-error" role="alert">
            {error}
          </p>
        ) : null}

        {data && !data.esDiaLaborable ? (
          <p className="teacher-attendance-notice" role="status">
            <CalendarDays size={16} aria-hidden /> Día no laborable según la configuración:
            no se contabilizan ausencias.
          </p>
        ) : null}

        <div className="admin-stats" aria-busy={loading}>
          <article className="admin-stat-card">
            <span>Presentes</span>
            <strong>{loading ? "…" : resumen?.presentes ?? 0}</strong>
          </article>
          <article className="admin-stat-card">
            <span>Tardanzas</span>
            <strong>{loading ? "…" : resumen?.tardanzas ?? 0}</strong>
          </article>
          <article className="admin-stat-card">
            <span>Ausentes</span>
            <strong>{loading ? "…" : resumen?.ausentes ?? 0}</strong>
          </article>
          <article className="admin-stat-card">
            <span>Sin marcar</span>
            <strong>{loading ? "…" : resumen?.sinMarcar ?? 0}</strong>
          </article>
          {!loading && (resumen?.justificados ?? 0) > 0 ? (
            <article className="admin-stat-card">
              <span>Justificados</span>
              <strong>{resumen?.justificados}</strong>
            </article>
          ) : null}
        </div>
      </section>

      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <h2 className="dashboard-panel__title">Registro diario</h2>
          <p className="dashboard-panel__subtitle">
            Marcaciones por huella y correcciones manuales. Por defecto se muestra el día
            actual.
          </p>
        </div>

        <div className="admin-toolbar teacher-attendance-toolbar">
          <label className="teacher-attendance-date">
            <span>Fecha</span>
            <input
              type="date"
              value={fecha}
              max={todayIsoDate()}
              onChange={(e) => setFecha(e.target.value || todayIsoDate())}
            />
          </label>

          <label className="admin-search">
            <Search size={18} aria-hidden />
            <span className="sr-only">Buscar profesor</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar profesor"
            />
          </label>

          <label className="teacher-attendance-filter">
            <span>Estado</span>
            <select
              value={estadoFilter}
              onChange={(e) =>
                setEstadoFilter(e.target.value as TeacherAttendanceDisplayEstado | "")
              }
            >
              <option value="">Todos</option>
              {STATUS_FILTERS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="projects-panel__action-btn teacher-attendance-config-btn"
            onClick={() => setConfigOpen(true)}
          >
            <Settings size={16} aria-hidden /> Configuración
          </button>
        </div>

        {loading ? (
          <div className="projects-table projects-table--empty" role="status">
            Cargando asistencia…
          </div>
        ) : visibleRecords.length === 0 ? (
          <div className="projects-table projects-table--empty" role="status">
            <UserX size={20} aria-hidden /> No hay profesores para el filtro seleccionado.
          </div>
        ) : (
          <div className="projects-table-wrapper">
            <table className="projects-table admin-table">
              <thead>
                <tr>
                  <th scope="col">Profesor</th>
                  <th scope="col">Horario esperado</th>
                  <th scope="col">Hora de entrada</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Método</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((record) => (
                  <tr key={record.userId}>
                    <td
                      className="projects-table__cell projects-table__cell--name"
                      data-label="Profesor"
                    >
                      <button
                        type="button"
                        className="teacher-attendance-name"
                        onClick={() => setDetailUserId(record.userId)}
                      >
                        {professorName(record)}
                      </button>
                      <small className="admin-table__subtext">
                        {record.huellaId !== null
                          ? `Huella #${record.huellaId}`
                          : "Sin huella"}
                      </small>
                    </td>
                    <td
                      className="projects-table__cell projects-table__cell--muted"
                      data-label="Horario esperado"
                    >
                      {data?.horaEntradaEsperada ?? "—"}
                    </td>
                    <td
                      className="projects-table__cell projects-table__cell--muted"
                      data-label="Hora de entrada"
                    >
                      {record.horaEntrada ?? "—"}
                    </td>
                    <td className="projects-table__cell" data-label="Estado">
                      <span className={`teacher-attendance-badge ${BADGE_CLASS[record.estado]}`}>
                        {record.estado}
                      </span>
                      {record.corregido ? (
                        <small className="teacher-attendance-detail__edited">Corregido</small>
                      ) : null}
                    </td>
                    <td
                      className="projects-table__cell projects-table__cell--muted"
                      data-label="Método"
                    >
                      {record.metodo ?? "—"}
                    </td>
                    <td
                      className="projects-table__cell projects-table__cell--actions"
                      data-label="Acciones"
                    >
                      <button
                        type="button"
                        className="projects-table__action"
                        onClick={() => setDetailUserId(record.userId)}
                      >
                        Ver
                      </button>
                      <button
                        type="button"
                        className="projects-table__action"
                        onClick={() => openCorrection(record)}
                      >
                        Corregir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <TeacherAttendanceDetailModal
        open={detailUserId !== null}
        userId={detailUserId ?? ""}
        fecha={fecha}
        refreshToken={refreshToken}
        onClose={() => setDetailUserId(null)}
        onCorrect={(payload) => {
          if (!detailUserId) return;
          const record = data?.registros.find((item) => item.userId === detailUserId);
          setCorrection({
            userId: detailUserId,
            professorName: record ? professorName(record) : "Profesor",
            fecha: payload.fecha,
            inicial: {
              estado: payload.estado,
              horaEntrada: payload.horaEntrada,
              observaciones: payload.observaciones,
            },
          });
        }}
      />

      <TeacherAttendanceCorrectionModal
        open={correction !== null}
        userId={correction?.userId ?? ""}
        professorName={correction?.professorName ?? ""}
        fecha={correction?.fecha ?? fecha}
        inicial={correction?.inicial ?? null}
        onClose={() => setCorrection(null)}
        onSaved={handleCorrected}
      />

      <TeacherAttendanceConfigModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        onSaved={handleCorrected}
      />
    </>
  );
}
