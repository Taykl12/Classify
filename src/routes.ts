export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  PROJECTS: '/proyectos',
  projectConfig: (id: string) => `/proyectos/${id}/config`,
  LOGIN: '/login',
  REGISTER: '/register',
  RECOVER_PASSWORD: '/recuperar-contrasena',
} as const;
