import { Navigate } from "react-router-dom";
import { ROUTES } from "../../routes";

export function HomeRedirect() {
  return <Navigate to={ROUTES.LOGIN} replace />;
}
