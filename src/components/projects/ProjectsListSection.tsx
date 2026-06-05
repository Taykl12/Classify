import { Star } from "lucide-react";
import type { ProjectListItem } from '../../types/projects';
import { formatProjectDate } from '../../utils/formatProjectDate';
import '../../styles/projects.css';

interface ProjectsListSectionProps {
  items: ProjectListItem[];
  isLoading?: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onEdit: (item: ProjectListItem) => void;
  onToggleFavorite: (item: ProjectListItem) => void;
}

const COLUMN_HEADERS = [
  '',
  'Fav.',
  'Nombre',
  'Detalles',
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
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onEdit,
  onToggleFavorite,
}: ProjectsListSectionProps) {
  const allSelected = items.length > 0 && items.every((i) => selectedIds.has(i.id));

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
        No hay proyectos por ahora. Creá uno con el botón «Crear Proyecto».
      </div>
    );
  }

  return (
    <div className="projects-table-wrapper">
      <table className="projects-table">
        <thead>
          <tr>
            <th scope="col" className="projects-table__th-check">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
                aria-label="Seleccionar todos los proyectos"
              />
            </th>
            {COLUMN_HEADERS.slice(1).map((header) => (
              <th key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={selectedIds.has(item.id) ? 'projects-table__row--selected' : undefined}>
              <td className="projects-table__cell projects-table__cell--check" data-label="Seleccionar">
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => onToggleSelect(item.id)}
                  aria-label={`Seleccionar ${item.name}`}
                />
              </td>
              <td className="projects-table__cell" data-label={COLUMN_HEADERS[1]}>
                <button
                  type="button"
                  className={`projects-favorite-btn${item.isFavorite ? ' projects-favorite-btn--active' : ''}`}
                  onClick={() => onToggleFavorite(item)}
                  aria-label={item.isFavorite ? `Quitar ${item.name} de favoritos` : `Marcar ${item.name} como favorito`}
                  aria-pressed={item.isFavorite}
                >
                  <Star
                    size={20}
                    aria-hidden
                    fill={item.isFavorite ? 'currentColor' : 'none'}
                  />
                </button>
              </td>
              <td
                className="projects-table__cell projects-table__cell--name"
                data-label={COLUMN_HEADERS[2]}
              >
                {item.name}
              </td>
              <td
                className="projects-table__cell projects-table__cell--muted projects-table__cell--details"
                data-label={COLUMN_HEADERS[3]}
                title={item.scopeNotes || undefined}
              >
                {item.scopeNotes || "—"}
              </td>
              <td className="projects-table__cell" data-label={COLUMN_HEADERS[4]}>
                <span className={statusBadgeClass(item.status)}>{item.status}</span>
              </td>
              <td
                className="projects-table__cell projects-table__cell--muted"
                data-label={COLUMN_HEADERS[5]}
              >
                {formatProjectDate(item.createdAt)}
              </td>
              <td
                className="projects-table__cell projects-table__cell--actions"
                data-label={COLUMN_HEADERS[6]}
              >
                <button
                  type="button"
                  className="projects-table__action"
                  onClick={() => onEdit(item)}
                >
                  Editar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
