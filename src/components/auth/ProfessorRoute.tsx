import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { isProfessor } from "../../lib/roles";
import { ROUTES } from "../../routes";

export function ProfessorRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <p className="auth-loading">Cargando…</p>;
  }

  if (!user) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  if (!isProfessor(user.roleLabel)) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return children;
}
