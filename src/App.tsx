import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { HomeRedirect } from "./components/auth/HomeRedirect";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import ProjectsPage from "./pages/ProjectsPage";
import RecoverPasswordPage from "./pages/RecoverPasswordPage";
import RegisterPage from "./pages/RegisterPage";
import { ROUTES } from "./routes";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path={ROUTES.HOME} element={<HomeRedirect />} />
          <Route
            path={ROUTES.DASHBOARD}
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path={ROUTES.PROJECTS}
            element={
              <ProtectedRoute>
                <ProjectsPage />
              </ProtectedRoute>
            }
          />
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
          <Route path={ROUTES.RECOVER_PASSWORD} element={<RecoverPasswordPage />} />
          <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
