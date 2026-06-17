import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { landingRouteForRole } from "../../lib/roles";
import { ROUTES } from "../../routes";

export function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <p className="auth-loading">Cargando…</p>;
  if (user) return <Navigate to={landingRouteForRole(user.roleLabel)} replace />;
  return <Navigate to={ROUTES.LOGIN} replace />;
}
