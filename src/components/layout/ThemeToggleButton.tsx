import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";

interface ThemeToggleButtonProps {
  className?: string;
  collapsed?: boolean;
}

export function ThemeToggleButton({
  className = "theme-toggle",
  collapsed = false,
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
      <span className={collapsed ? "sr-only" : "theme-toggle__label"}>
        {isDark ? "Modo claro" : "Modo oscuro"}
      </span>
    </button>
  );
}
