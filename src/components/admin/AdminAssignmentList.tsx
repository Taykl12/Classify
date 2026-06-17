import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

interface AssignmentOption {
  id: string;
  label: string;
  detail?: string;
  searchText?: string;
}

interface AdminAssignmentListProps {
  title: string;
  options: AssignmentOption[];
  selectedIds: Set<string>;
  emptyText: string;
  onToggle: (id: string) => void;
  searchable?: boolean;
  requireSearchQuery?: boolean;
  searchPlaceholder?: string;
  noResultsText?: string;
  searchPromptText?: string;
  resetKey?: string;
}

function matchesAssignmentQuery(option: AssignmentOption, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return false;
  const haystack = [option.label, option.detail, option.searchText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

export function AdminAssignmentList({
  title,
  options,
  selectedIds,
  emptyText,
  onToggle,
  searchable = false,
  requireSearchQuery = false,
  searchPlaceholder = "Buscar por nombre, correo o DNI",
  noResultsText = "No se encontraron coincidencias.",
  searchPromptText = "Escribí DNI, correo o nombre para buscar usuarios.",
  resetKey,
}: AdminAssignmentListProps) {
  const [query, setQuery] = useState("");
  const hasQuery = query.trim().length > 0;

  useEffect(() => {
    setQuery("");
  }, [resetKey]);

  const visibleOptions = useMemo(() => {
    if (!searchable) return options;
    if (requireSearchQuery && !hasQuery) return [];
    if (!hasQuery) return options;
    return options.filter((option) => matchesAssignmentQuery(option, query));
  }, [options, query, searchable, requireSearchQuery, hasQuery]);

  return (
    <div className="admin-assignment" role="group" aria-label={title}>
      <p className="admin-assignment__title">{title}</p>
      {searchable ? (
        <label className="admin-search admin-assignment__search">
          <Search size={18} aria-hidden />
          <span className="sr-only">{searchPlaceholder}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
          />
        </label>
      ) : null}
      {options.length === 0 ? (
        <p className="admin-assignment__empty">{emptyText}</p>
      ) : requireSearchQuery && !hasQuery ? (
        <p className="admin-assignment__empty">{searchPromptText}</p>
      ) : visibleOptions.length === 0 ? (
        <p className="admin-assignment__empty">{noResultsText}</p>
      ) : (
        <div className="admin-assignment__list">
          {visibleOptions.map((option) => (
            <label key={option.id} className="admin-assignment__item">
              <input
                type="checkbox"
                checked={selectedIds.has(option.id)}
                onChange={() => onToggle(option.id)}
              />
              <span>
                <strong>{option.label}</strong>
                {option.detail ? <small>{option.detail}</small> : null}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
