import { useEffect, useState } from "react";
import { Fingerprint, History, Loader2 } from "lucide-react";
import { AdminModal } from "./AdminModal";
import { apiFetchWithRetry } from "../../lib/api";
import type {
  TeacherAttendanceEstado,
  TeacherAttendanceHistoryResponse,
} from "../../types/admin";
import { formatAttendanceDate } from "../../lib/professorDisplay";

interface TeacherAttendanceDetailModalProps {
  open: boolean;
  userId: string;
  fecha: string;
  refreshToken: number;
  onClose: () => void;
  onCorrect: (payload: {
    fecha: string;
    estado: TeacherAttendanceEstado;
    horaEntrada: string | null;
    observaciones: string;
  }) => void;
}

const STATUS_CLASS: Record<TeacherAttendanceEstado, string> = {
  Presente: "teacher-attendance-badge--presente",
  Tardanza: "teacher-attendance-badge--tardanza",
  Ausente: "teacher-attendance-badge--ausente",
  Justificado: "teacher-attendance-badge--justificado",
};

function statusClass(estado: TeacherAttendanceEstado): string {
  return STATUS_CLASS[estado] ?? "";
}

export function TeacherAttendanceDetailModal({
  open,
  userId,
  fecha,
  refreshToken,
  onClose,
  onCorrect,
}: TeacherAttendanceDetailModalProps) {
  const [data, setData] = useState<TeacherAttendanceHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetchWithRetry<TeacherAttendanceHistoryResponse>(
      `/api/admin/asistencia-profesores/${userId}/historial`
    )
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, userId, refreshToken]);

  const todayRecord = data?.historial.find((item) => item.fecha === fecha) ?? null;
  const professor = data?.profesor;

  return (
    <AdminModal
      open={open}
      title={professor ? `Asistencia de ${professor.nombreCompleto}` : "Asistencia"}
      error={error}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="project-modal__btn project-modal__btn--muted"
            onClick={onClose}
          >
            Cerrar
          </button>
          <button
            type="button"
            className="project-modal__btn project-modal__btn--primary"
            onClick={() =>
              onCorrect({
                fecha,
                estado: todayRecord?.estado ?? "Presente",
                horaEntrada: todayRecord?.horaEntrada ?? null,
                observaciones: todayRecord?.observaciones ?? "",
              })
            }
          >
            Corregir este día
          </button>
        </>
      }
    >
      <div className="teacher-attendance-detail">
        {loading && !data ? (
          <p className="teacher-attendance-detail__status" role="status">
            <Loader2 size={18} className="fingerprint-modal__spinner" aria-hidden />
            Cargando historial…
          </p>
        ) : null}

        {professor ? (
          <div className="teacher-attendance-detail__summary">
            <div className="teacher-attendance-detail__identity">
              {professor.profilePhotoUrl ? (
                <img
                  src={professor.profilePhotoUrl}
                  alt=""
                  className="teacher-attendance-detail__avatar"
                />
              ) : (
                <span className="teacher-attendance-detail__avatar teacher-attendance-detail__avatar--fallback">
                  <Fingerprint size={22} aria-hidden />
                </span>
              )}
              <div>
                <p className="teacher-attendance-detail__name">
                  {professor.nombreCompleto}
                </p>
                <p className="teacher-attendance-detail__meta">
                  {professor.huellaId !== null
                    ? `Slot de huella #${professor.huellaId}`
                    : "Sin huella asignada"}
                </p>
              </div>
            </div>

            <dl className="teacher-attendance-detail__facts">
              <div>
                <dt>Fecha</dt>
                <dd>{formatAttendanceDate(fecha)}</dd>
              </div>
              <div>
                <dt>Entrada</dt>
                <dd>{todayRecord?.horaEntrada ?? "—"}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>
                  {todayRecord ? (
                    <span
                      className={`teacher-attendance-badge ${statusClass(todayRecord.estado)}`}
                    >
                      {todayRecord.estado}
                    </span>
                  ) : (
                    <span className="teacher-attendance-badge teacher-attendance-badge--sinmarcar">
                      Sin registro
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt>Método</dt>
                <dd>{todayRecord?.metodo ?? "—"}</dd>
              </div>
            </dl>

            {todayRecord?.observaciones ? (
              <p className="teacher-attendance-detail__note">
                Observaciones: {todayRecord.observaciones}
              </p>
            ) : null}
          </div>
        ) : null}

        {data && data.historial.length > 0 ? (
          <div className="teacher-attendance-detail__history">
            <p className="teacher-attendance-detail__history-title">
              <History size={16} aria-hidden /> Historial reciente
            </p>
            <div className="projects-table-wrapper teacher-attendance-detail__table-wrap">
              <table className="projects-table admin-table">
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Entrada</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Método</th>
                    <th scope="col">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {data.historial.map((item) => (
                    <tr key={item.fecha}>
                      <td className="projects-table__cell" data-label="Fecha">
                        {formatAttendanceDate(item.fecha)}
                        {item.corregido ? (
                          <span className="teacher-attendance-detail__edited">Corregido</span>
                        ) : null}
                      </td>
                      <td className="projects-table__cell projects-table__cell--muted" data-label="Entrada">
                        {item.horaEntrada ?? "—"}
                      </td>
                      <td className="projects-table__cell" data-label="Estado">
                        <span
                          className={`teacher-attendance-badge ${statusClass(item.estado)}`}
                        >
                          {item.estado}
                        </span>
                      </td>
                      <td className="projects-table__cell projects-table__cell--muted" data-label="Método">
                        {item.metodo}
                      </td>
                      <td className="projects-table__cell projects-table__cell--actions" data-label="Acción">
                        <button
                          type="button"
                          className="projects-table__action"
                          onClick={() =>
                            onCorrect({
                              fecha: item.fecha,
                              estado: item.estado,
                              horaEntrada: item.horaEntrada,
                              observaciones: item.observaciones,
                            })
                          }
                        >
                          Corregir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {!loading && data && data.historial.length === 0 ? (
          <p className="teacher-attendance-detail__status">
            Sin marcaciones registradas todavía.
          </p>
        ) : null}
      </div>
    </AdminModal>
  );
}
