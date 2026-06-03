import type { ProjectListItem } from '../../types/projects';
import { formatProjectDate } from '../../utils/formatProjectDate';
import '../../styles/projects.css';

interface ProjectsListSectionProps {
  items: ProjectListItem[];
  isLoading?: boolean;
}

const COLUMN_HEADERS = [
  'Escuela',
  'Nombre',
  'Descripción',
  'Estado',
  'Creado',
  'Acciones',
] as const;

function statusBadgeClass(status: ProjectListItem['status']): string {
  return status === 'Abierto'
    ? 'projects-badge projects-badge--status-open'
    : 'projects-badge projects-badge--status-closed';
}

export function ProjectsListSection({
  items,
  isLoading = false,
}: ProjectsListSectionProps) {
  if (isLoading) {
    return (
      <div className="projects-table projects-table--empty" role="status">
        Cargando proyectos…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="projects-table projects-table--empty" role="status">
        No hay proyectos por ahora.
      </div>
    );
  }

  return (
    <div className="projects-table-wrapper">
      <table className="projects-table">
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
              <td className="projects-table__cell" data-label={COLUMN_HEADERS[0]}>
                <span className="projects-badge projects-badge--school">
                  {item.school}
                </span>
              </td>
              <td
                className="projects-table__cell projects-table__cell--name"
                data-label={COLUMN_HEADERS[1]}
              >
                {item.name}
              </td>
              <td
                className="projects-table__cell projects-table__cell--muted"
                data-label={COLUMN_HEADERS[2]}
                title={item.description}
              >
                {item.description}
              </td>
              <td className="projects-table__cell" data-label={COLUMN_HEADERS[3]}>
                <span className={statusBadgeClass(item.status)}>{item.status}</span>
              </td>
              <td
                className="projects-table__cell projects-table__cell--muted"
                data-label={COLUMN_HEADERS[4]}
              >
                {formatProjectDate(item.createdAt)}
              </td>
              <td
                className="projects-table__cell projects-table__cell--actions"
                data-label={COLUMN_HEADERS[5]}
              >
                <button
                  type="button"
                  className="projects-table__action"
                  aria-label={`Editar proyecto ${item.name}`}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="projects-table__action"
                  aria-label={`Ver proyecto ${item.name}`}
                >
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
