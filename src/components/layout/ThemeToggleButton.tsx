import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";

interface ThemeToggleButtonProps {
  className?: string;
}

export function ThemeToggleButton({
  className = "theme-toggle",
}: ThemeToggleButtonProps) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className={className}
      onClick={toggleTheme}
      aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"}
      title={isDark ? "Modo claro" : "Modo oscuro"}
    >
      {isDark ? <Sun size={22} aria-hidden /> : <Moon size={22} aria-hidden />}
      {/* Siempre renderizado: cada contexto decide si mostrarlo (ver theme-toggle.css).
          Montarlo/desmontarlo lo haría aparecer de golpe al abrir el sidebar. */}
      <span className="theme-toggle__label" aria-hidden="true">
        {isDark ? "Modo claro" : "Modo oscuro"}
      </span>
    </button>
  );
}
