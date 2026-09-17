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
 * TODAS las rutas privadas viven bajo UN SOLO layout route sin path.
 *
 * Es deliberado: con un layout route por rol (admin / profesor / alumno), cruzar
 * de un grupo a otro —por ejemplo del panel del profesor a "Proyectos"— haria que
 * React desmonte y remonte el `DashboardLayout`, recreando el Sidebar. Un elemento
 * recien montado nace ya en su estado activo: no tiene estado previo que animar,
 * asi que las transiciones de la seleccion no corren.
 *
 * La autorizacion por rol NO necesita layouts separados: cada ruta privada
 * envuelve su pagina con la guarda que corresponda (ProfessorRoute / AdminRoute).
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

              <Route
                path={ROUTES.PROFESSOR}
                element={
                  <ProfessorRoute>
                    <ProfessorDashboardPage />
                  </ProfessorRoute>
                }
              />
              <Route
                path={ROUTES.PROFESSOR_COURSES}
                element={
                  <ProfessorRoute>
                    <ProfessorCoursesPage />
                  </ProfessorRoute>
                }
              />
              <Route
                path="/profesor/cursos/:courseId"
                element={
                  <ProfessorRoute>
                    <ProfessorCourseDetailPage />
                  </ProfessorRoute>
                }
              />
              <Route
                path={ROUTES.PROFESSOR_ATTENDANCE}
                element={
                  <ProfessorRoute>
                    <ProfessorAttendancePage />
                  </ProfessorRoute>
                }
              />
              <Route
                path="/profesor/asistencia/:courseId"
                element={
                  <ProfessorRoute>
                    <ProfessorAttendanceCoursePage />
                  </ProfessorRoute>
                }
              />

              <Route
                path={ROUTES.ADMIN}
                element={
                  <AdminRoute>
                    <AdminDashboardPage />
                  </AdminRoute>
                }
              />
              <Route
                path={ROUTES.ADMIN_USERS}
                element={
                  <AdminRoute>
                    <AdminUsersPage />
                  </AdminRoute>
                }
              />
              <Route
                path={ROUTES.ADMIN_COURSES}
                element={
                  <AdminRoute>
                    <AdminCursosPage />
                  </AdminRoute>
                }
              />
              <Route
                path={ROUTES.ADMIN_SUBJECTS}
                element={
                  <AdminRoute>
                    <AdminMateriasPage />
                  </AdminRoute>
                }
              />
              <Route
                path={ROUTES.ADMIN_PROJECTS}
                element={
                  <AdminRoute>
                    <AdminProyectosPage />
                  </AdminRoute>
                }
              />
              <Route
                path={ROUTES.ADMIN_ESP32}
                element={
                  <AdminRoute>
                    <AdminEsp32Page />
                  </AdminRoute>
                }
              />
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
