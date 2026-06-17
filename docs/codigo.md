# Guía del código — Classify

Documentación del funcionamiento de la aplicación web: arquitectura, flujos principales y puntos que conviene tener presentes al desarrollar.

> Complementa: [`estructura_db.md`](./estructura_db.md) (base de datos), [`migraciones.md`](./migraciones.md) (SQL), [`calendario.md`](./calendario.md), [`preferencias.md`](./preferencias.md) y [`profesor.md`](./profesor.md) (páginas concretas).

---

## 1. Qué es este proyecto

**Classify** es una plataforma educativa con:

- **Frontend:** React 19 + TypeScript + Vite (puerto `5173`)
- **Backend:** Express 5 + TypeScript (puerto `3001`)
- **Datos y auth:** Supabase (Postgres + Auth + Storage)

El frontend **no habla directo con Supabase** en el flujo normal: llama a `/api/*`, Vite reenvía al servidor Express, y Express usa el cliente Supabase con el JWT del usuario.

```
┌─────────────┐     /api/*      ┌──────────────┐    Supabase JS    ┌─────────────┐
│   React     │ ──────────────► │   Express    │ ────────────────► │  Postgres   │
│  (Vite)     │   Bearer JWT    │   :3001      │   + RLS           │  Auth       │
└─────────────┘                 └──────────────┘                   │  Storage    │
                                                                    └─────────────┘
```

---

## 2. Arranque en desarrollo

| Comando | Qué levanta |
|---------|------------|
| `npm run dev` | Frontend Vite en `:5173` |
| `npm run dev:server` | API Express en `:3001` |

**Requisito:** copiar `server/.env.example` → `server/.env` con `SUPABASE_URL` y `SUPABASE_ANON_KEY`.

El proxy de Vite (`vite.config.ts`) redirige `/api` → `http://localhost:3001`. Por eso en el frontend siempre se usa rutas relativas como `/api/projects`.

---

## 3. Estructura de carpetas

```
src/                          Frontend React
├── main.tsx                  Entrada: tema + CSS global
├── App.tsx                   Router + providers
├── routes.ts                 Paths centralizados (español)
├── lib/api.ts                fetch con token, retry, logout en 401
├── contexts/                 AuthContext, ThemeContext
├── pages/                    Una página por ruta principal
│   ├── professor/            Panel profesor, cursos, asistencia
│   └── admin/                Panel admin (cursos, materias, usuarios)
├── components/               UI reutilizable (layout, auth, projects, dashboard)
├── types/                    Interfaces TypeScript compartidas
├── styles/                   CSS vanilla por página/componente
└── hooks/                    Lógica UI reutilizable (sidebar, carrusel, viewport)

server/src/                   Backend Express
├── index.ts                  Arranca el servidor
├── app.ts                    CORS, JSON, montaje de routers
├── config.ts                 Variables de entorno
├── middleware/auth.ts        requireAuth + getUserSupabase
├── routes/                   auth, projects, dashboard, users, profile
└── lib/                      Supabase, permisos, mappers, miembros

supabase/migrations/          Cambios SQL versionados
docs/                         Documentación del proyecto
```

---

## 4. Frontend

### 4.1 Entrada y providers

`main.tsx` aplica el tema guardado (`classify-theme` en `localStorage`) antes de montar React.

`App.tsx` envuelve todo en este orden:

1. `ThemeProvider` — light/dark vía `[data-theme="dark"]`
2. `AuthProvider` — sesión del usuario
3. `BrowserRouter` — rutas

### 4.2 Rutas

Definidas en `src/routes.ts`. Rutas protegidas usan `<ProtectedRoute>`: si no hay sesión, redirige a `/login`.

| Ruta | Página | Notas |
|------|--------|-------|
| `/` | Redirige según sesión | `HomeRedirect` |
| `/login`, `/register`, `/recuperar-contrasena` | Auth pública | |
| `/dashboard` | Inicio | Carrusel favoritos + tareas pendientes |
| `/proyectos` | Listado | CRUD, favoritos, borrado masivo |
| `/proyectos/:id/config` | Configuración | Pestañas alcance, docs, equipo, calificaciones |
| `/calendario` | Calendario mensual | Ver [`calendario.md`](./calendario.md) |
| `/preferencias` | Perfil de cuenta | Ver [`preferencias.md`](./preferencias.md) |
| `/admin` | Panel administración | Solo rol admin |
| `/profesor` | Panel profesor | Ver [`profesor.md`](./profesor.md) |
| `/profesor/cursos`, `/profesor/asistencia` | Cursos y asistencia | Subrutas del panel profesor |

### 4.3 Layout autenticado

Las páginas internas usan `DashboardLayout`: sidebar fijo + `<main>`. El sidebar lee `useAuth()` para nombre, rol y avatar.

Estado del sidebar colapsado: `localStorage.classify-sidebar-collapsed`.

### 4.4 Cliente HTTP — `lib/api.ts`

Pieza central del frontend:

- Token en `localStorage.classify_access_token`
- Cada request lleva `Authorization: Bearer <token>`
- Error **401** → limpia sesión y ejecuta handler registrado por `AuthContext` (desloguea la UI)
- `apiFetchWithRetry` reintenta hasta 3 veces en `502/503/504` o fallos de red (`TypeError`)

**Importante:** casi todas las páginas usan `apiFetch` o `apiFetchWithRetry`. No hay otro cliente HTTP.

### 4.5 AuthContext

Al montar, si hay token llama `GET /api/auth/me` para validarlo.

| Método | Endpoint | Efecto |
|--------|----------|--------|
| `login` | `POST /api/auth/login` | Guarda token + usuario |
| `register` | `POST /api/auth/register` | Registro; puede pedir confirmación por email |
| `logout` | `POST /api/auth/logout` | Limpia localStorage |
| `recoverPassword` | `POST /api/auth/recover-password` | Email de reset Supabase |
| `refreshUser` | — | Actualiza usuario en memoria tras editar perfil |

Usuario en memoria (`AuthUser`): `id`, `email`, `firstName`, `lastName`, `roleLabel`, `profilePhotoUrl`.

### 4.6 Estilos

- **CSS vanilla** — no Tailwind
- Tokens de diseño en `styles/variables.css` (light por defecto, dark con `[data-theme="dark"]`)
- Un CSS por página o componente grande (`project-config.css`, `Calendary.css`, etc.)
- Textos de UI en **español**
- Tablas responsivas: atributo `data-label` en celdas para apilar en móvil (≤768px)

---

## 5. Backend

### 5.1 Montaje — `app.ts`

Routers bajo prefijo `/api`:

| Prefijo | Archivo | Responsabilidad |
|---------|---------|-----------------|
| `/api/auth` | `routes/auth.ts` | Login, registro, me, recuperar contraseña |
| `/api/projects` | `routes/projects.ts` | CRUD proyectos, favoritos, config |
| `/api/dashboard` | `routes/dashboard.ts` | Favoritos destacados, tareas pendientes |
| `/api/users` | `routes/users.ts` | Búsqueda de usuarios para invitar |
| `/api/profile` | `routes/profile.ts` | GET/PATCH perfil + avatar |
| `/api/professor` | `routes/professor.ts` | Cursos, alumnos y asistencia (solo profesor) |
| `/api/admin` | `routes/admin.ts` | Gestión académica y usuarios (solo admin) |

Health check: `GET /api/health`.

### 5.2 Autenticación — `middleware/auth.ts`

`requireAuth`:

1. Lee header `Authorization: Bearer …`
2. Valida el JWT con `supabase.auth.getUser(token)`
3. Guarda en el request: `accessToken` y `userId`

`getUserSupabase(req)` crea un cliente Supabase **con el token del usuario**. Todas las queries pasan por **RLS** de Postgres como ese usuario.

Hay dos clientes en `lib/supabase.ts`:

| Función | Uso |
|---------|-----|
| `createAnonClient()` | Login, registro, validar token (sin sesión de usuario en el cliente) |
| `createUserClient(token)` | Operaciones autenticadas con RLS |
| `createAdminClient()` | Rutas admin y profesor que necesitan leer/escribir sin depender de RLS del JWT |

### 5.3 Registro y perfil

**Registro** (`POST /api/auth/register`):

1. `supabase.auth.signUp` → usuario en Auth
2. Si hay sesión inmediata, inserta fila en `usuarios` con rol `alumno` (id 3)
3. Devuelve `accessToken` + perfil mapeado

**Perfil** (`PATCH /api/profile`):

- Actualiza `usuarios` (nombre, apellido, DNI, `foto_perfil`)
- Avatar: base64 → Storage bucket `avatars` → URL pública en `foto_perfil`
- Email y contraseña: `auth.updateUser` del cliente con token del usuario

### 5.4 Roles y landing

`src/lib/roles.ts` define helpers por etiqueta de rol (`isAdmin`, `isProfessor`). Tras el login, `landingRouteForRole()` envía a:

- Admin → `/admin`
- Profesor → `/profesor`
- Resto (alumno, etc.) → `/dashboard`

El sidebar (`Sidebar.tsx`) elige el menú según rol: `ADMIN_NAV`, `PROFESSOR_NAV` o `MAIN_NAV`.

Detalle del módulo profesor: [`profesor.md`](./profesor.md).

---

## 6. Proyectos — lógica importante

### 6.1 Modelo de acceso

Un proyecto (`grupos_proyectos`) se relaciona con usuarios de dos formas:

| Relación | Tabla | Significado |
|----------|-------|-------------|
| Dueño / creador | `proyecto_profesor` | Quien creó el proyecto |
| Integrante | `grupo_estudiante` | Miembros invitados por email |

`getAccessibleGroupIds()` (en `server/lib/projectAccess.ts`) une ambos conjuntos. Eso define **qué proyectos ve** el usuario.

### 6.2 Quién puede hacer qué

Reglas en **API** (además de RLS en Supabase):

| Acción | Permiso |
|--------|---------|
| Ver listado / detalle | Dueño **o** integrante |
| Crear proyecto | Cualquier autenticado (queda como dueño) |
| Editar nombre, estado, alcance, docs, integrantes | **Solo dueño** |
| Marcar favorito | **Solo dueño** |
| Borrar (uno o bulk) | **Solo dueño** |
| `anteproyecto_validado` | Usuario con rol **profesor** (dueño o integrante profesor) |

La UI en `ProjectConfigPage` deshabilita campos según `isOwner` y `isProfessor()`.

### 6.3 Creación atómica

`POST /api/projects` llama la RPC `create_grupo_proyecto`: inserta el grupo y el vínculo en `proyecto_profesor` en una transacción. Evita fallos de RLS al hacer `INSERT … RETURNING` en dos pasos separados.

### 6.4 Integrantes por email

1. Frontend: `EmailChipInput` busca con `GET /api/users/search?q=`
2. Backend usa RPC `search_usuarios_for_invite` (DNI, email, nombre)
3. Al guardar: `syncGroupMembers` resuelve cada email con `find_user_id_by_email`, borra integrantes previos e inserta los nuevos en `grupo_estudiante`
4. Emails sin cuenta registrada → error 400 con lista

El dueño no se guarda en `grupo_estudiante`; su email viene de `get_project_owner_email`.

### 6.5 Documentos del proyecto

No hay upload de archivos al servidor. Los documentos son un array JSONB en `grupos_proyectos.documentos`:

```json
[{ "nombre": "Entrega 1", "url": "https://drive.google.com/..." }]
```

---

## 7. Dashboard

| Endpoint | Qué devuelve |
|----------|--------------|
| `GET /api/dashboard/featured` | Proyectos con `es_favorito = true`, ordenados por tareas no completadas |
| `GET /api/dashboard/pending` | Tareas en estado `Pendiente` o `En Progreso` de proyectos accesibles |

Ambos filtran por `getAccessibleGroupIds` — un integrante ve datos de sus grupos, no solo los que creó.

---

## 8. Mapeo BD ↔ API ↔ UI

`server/lib/mappers.ts` traduce filas de Postgres a JSON camelCase para el frontend (`mapProjectListItem`, `mapProjectDetail`, etc.).

El frontend usa tipos en `src/types/` (`projects.ts`, `dashboard.ts`, `profile.ts`, `users.ts`).

**Convención:** nombres en español en BD (`nombre_proyecto`, `estado_proyecto`), camelCase en JSON de la API (`name`, `status`).

---

## 9. localStorage usado por la app

| Clave | Dónde | Para qué |
|-------|-------|----------|
| `classify_access_token` | `lib/api.ts` | JWT de sesión |
| `classify_user` | `AuthContext` | Cache del usuario (secundario al token) |
| `classify-theme` | `ThemeContext`, `main.tsx` | `light` / `dark` |
| `classify-sidebar-collapsed` | `useSidebarCollapsed` | Sidebar compacto |

---

## 10. Convenciones al tocar código

1. **Rutas:** agregar path en `routes.ts` y ruta en `App.tsx`; proteger con `ProtectedRoute` si requiere login.
2. **API nueva:** router en `server/src/routes/`, registrar en `app.ts`, usar `requireAuth` + `getUserSupabase`.
3. **Permisos de proyecto:** reutilizar `assertCanAccessGroup` / `assertIsProjectOwner` — no duplicar queries a `proyecto_profesor`.
4. **Estilos:** variables de `variables.css`; evitar colores hardcodeados en JSX.
5. **TypeScript:** sin `any`; interfaces explícitas en `types/`.
6. **Componentes:** funcionales; si un archivo supera ~250 líneas, conviene dividir.
7. **BD:** cambio de esquema → migración en `supabase/migrations/` + actualizar [`migraciones.md`](./migraciones.md) y [`estructura_db.md`](./estructura_db.md).

---

## 11. Flujo típico de una pantalla

Ejemplo: listado de proyectos (`ProjectsPage`).

```
1. ProtectedRoute confirma sesión
2. DashboardLayout renderiza sidebar + contenido
3. useEffect → apiFetchWithRetry('/api/projects')
4. Express: requireAuth → getAccessibleGroupIds → SELECT grupos_proyectos
5. mapProjectListItem → JSON al frontend
6. ProjectsListSection muestra tabla; acciones llaman PATCH/DELETE según isOwner
```

Mismo patrón en dashboard, config de proyecto y preferencias: **página → apiFetch → router Express → Supabase con RLS → mapper → estado React**.

---

## 12. Qué falta / fuera de alcance actual

- **Calendario:** UI mensual; aún no persiste eventos en BD (ver [`calendario.md`](./calendario.md)).
- **Kanban / tareas:** tablas existen (`tareas_grupo`); la UI de tablero no está en esta rama.
- **Tests:** no hay framework de tests configurado.
- **Refresh token:** la API devuelve `refreshToken` en login/registro pero el frontend no lo renueva automáticamente; depende de la duración del JWT de Supabase.

---

## 13. Índice de documentación

| Documento | Contenido |
|-----------|-----------|
| [`codigo.md`](./codigo.md) | Esta guía — arquitectura y código |
| [`estructura_db.md`](./estructura_db.md) | Esquema completo de tablas, RLS, RPC |
| [`migraciones.md`](./migraciones.md) | Historial SQL `001`–`009` |
| [`supabase-schema.md`](./supabase-schema.md) | Referencia rápida del esquema |
| [`calendario.md`](./calendario.md) | Detalle de `/calendario` |
| [`preferencias.md`](./preferencias.md) | Detalle de `/preferencias` |
| `AGENTS.md` (raíz) | Resumen para agentes IA / onboarding rápido |
