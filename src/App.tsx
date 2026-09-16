import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AdminRoute } from "./components/auth/AdminRoute";
import { ProfessorRoute } from "./components/auth/ProfessorRoute";
import { HomeRedirect } from "./components/auth/HomeRedirect";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import CalendaryPage from "./pages/Calendary";
import AdminCursosPage from "./pages/admin/AdminCursosPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminMateriasPage from "./pages/admin/AdminMateriasPage";
import AdminProyectosPage from "./pages/admin/AdminProyectosPage";
import AdminEsp32Page from "./pages/admin/AdminEsp32Page";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import ProfessorAttendanceCoursePage from "./pages/professor/ProfessorAttendanceCoursePage";
import ProfessorAttendancePage from "./pages/professor/ProfessorAttendancePage";
import ProfessorCourseDetailPage from "./pages/professor/ProfessorCourseDetailPage";
import ProfessorCoursesPage from "./pages/professor/ProfessorCoursesPage";
import ProfessorDashboardPage from "./pages/professor/ProfessorDashboardPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import ProjectConfigPage from "./pages/ProjectConfigPage";
import ProjectsPage from "./pages/ProjectsPage";
import PreferencesPage from "./pages/PreferencesPage";
import RecoverPasswordPage from "./pages/RecoverPasswordPage";
import RegisterPage from "./pages/RegisterPage";
import { ROUTES } from "./routes";

/**
 * Las rutas privadas viven bajo un layout route sin path: `DashboardLayout` se
 * monta UNA vez y sobrevive a la navegacion (las paginas ya no lo envuelven).
 * Si cada pagina montara su propio layout, el Sidebar se remontaria en cada
 * cambio de seccion y sus transiciones no tendrian estado previo que animar.
 */
function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path={ROUTES.HOME} element={<HomeRedirect />} />

            <Route
              element={
                <AdminRoute>
                  <DashboardLayout />
                </AdminRoute>
              }
            >
              <Route path={ROUTES.ADMIN} element={<AdminDashboardPage />} />
              <Route path={ROUTES.ADMIN_USERS} element={<AdminUsersPage />} />
              <Route path={ROUTES.ADMIN_COURSES} element={<AdminCursosPage />} />
              <Route path={ROUTES.ADMIN_SUBJECTS} element={<AdminMateriasPage />} />
              <Route path={ROUTES.ADMIN_PROJECTS} element={<AdminProyectosPage />} />
              <Route path={ROUTES.ADMIN_ESP32} element={<AdminEsp32Page />} />
            </Route>

            <Route
              element={
                <ProfessorRoute>
                  <DashboardLayout />
                </ProfessorRoute>
              }
            >
              <Route path={ROUTES.PROFESSOR} element={<ProfessorDashboardPage />} />
              <Route path={ROUTES.PROFESSOR_COURSES} element={<ProfessorCoursesPage />} />
              <Route path="/profesor/cursos/:courseId" element={<ProfessorCourseDetailPage />} />
              <Route path={ROUTES.PROFESSOR_ATTENDANCE} element={<ProfessorAttendancePage />} />
              <Route path="/profesor/asistencia/:courseId" element={<ProfessorAttendanceCoursePage />} />
            </Route>

            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
              <Route path={ROUTES.PROJECTS} element={<ProjectsPage />} />
              <Route path={ROUTES.CALENDARY} element={<CalendaryPage />} />
              <Route path={ROUTES.PREFERENCES} element={<PreferencesPage />} />
              <Route path="/proyectos/:projectId/config" element={<ProjectConfigPage />} />
            </Route>

            <Route path={ROUTES.LOGIN} element={<LoginPage />} />
            <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
            <Route path={ROUTES.RECOVER_PASSWORD} element={<RecoverPasswordPage />} />
            <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
