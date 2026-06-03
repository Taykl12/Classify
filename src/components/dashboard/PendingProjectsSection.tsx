import type { PendingItem } from '../../types/dashboard';
import '../../styles/pending.css';

interface PendingProjectsSectionProps {
  items: PendingItem[];
  isLoading?: boolean;
}

const COLUMN_HEADERS = [
  'Descripción',
  'Proyecto',
  'Prioridad',
  'Estado',
  'Acciones',
] as const;

export function PendingProjectsSection({
  items,
  isLoading = false,
}: PendingProjectsSectionProps) {
  if (isLoading) {
    return (
      <div className="pending-table pending-table--empty" role="status">
        Cargando pendientes…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="pending-table pending-table--empty" role="status">
        No hay pendientes por ahora.
      </div>
    );
  }

  return (
    <div className="pending-table-wrapper">
      <table className="pending-table">
        <thead>
          <tr>
            {COLUMN_HEADERS.map((header) => (
              <th key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td
                className="pending-table__cell pending-table__cell--muted"
                data-label={COLUMN_HEADERS[0]}
              >
                {item.summary}
              </td>
              <td className="pending-table__cell" data-label={COLUMN_HEADERS[1]}>
                {item.projectName}
              </td>
              <td className="pending-table__cell" data-label={COLUMN_HEADERS[2]}>
                {item.priority}
              </td>
              <td className="pending-table__cell" data-label={COLUMN_HEADERS[3]}>
                {item.status}
              </td>
              <td
                className="pending-table__cell pending-table__cell--actions"
                data-label={COLUMN_HEADERS[4]}
              >
                <button type="button" className="pending-table__action">
                  Editar
                </button>
                <button type="button" className="pending-table__action">
                  Ver
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
