# Classify — AGENTS.md

## Stack

- **Frontend:** React 19, TypeScript, Vite 6, react-router-dom, lucide-react
- **Styling:** CSS vanilla (NOT Tailwind — ignore `.cursor/rules/frontend.mdc` which says Tailwind)
- **Backend:** Express 5, TypeScript (`server/`)
- **DB/Auth:** Supabase (`jgrtmokyqdvdxsldmkou`)

## Dev commands

| Command | What |
|---------|------|
| `pnpm run dev` | Vite frontend on `:5173` |
| `pnpm run dev:server` | Express API on `:3001` (via `tsx watch`) |
| `pnpm run build` | `tsc -b && vite build` |
| `pnpm run build:server` | `pnpm --filter classify-server build` |
| `pnpm run preview` | Vite preview of production build |

Or use the `.bat` files on Windows: `start-api.bat`, `start-vite.bat`, `start-dev.bat`.

## Dev setup

1. Copy `server/.env.example` → `server/.env` and fill `SUPABASE_ANON_KEY` (from Supabase project dashboard)
2. `pnpm install` at repo root (workspace installs frontend + server)
3. `pnpm run dev:server` in one terminal, `pnpm run dev` in another
3. Vite proxy forwards `/api/*` → Express on `:3001`

## Project structure

```
src/               React frontend
  main.tsx         Entrypoint (reads `classify-theme` from localStorage)
  App.tsx          Router + AuthProvider + ThemeProvider
  routes.ts        ROUTES constant (paths in Spanish: /proyectos, /calendario, /recuperar-contrasena)
  lib/api.ts       apiFetch / apiFetchWithRetry — Bearer token from localStorage, auto-logout on 401
  contexts/        AuthContext (Supabase login/register/logout), ThemeContext (light/dark toggle)
  components/
    auth/          LoginPage, RegisterPage, RecoverPasswordPage helpers
    layout/        DashboardLayout + Sidebar
    dashboard/     FeaturedProjectsCarousel + PendingProjectsSection
    projects/      ProjectFormModal, ProjectsListSection, EmailChipInput
  styles/
    variables.css  Design tokens (light default, optional [data-theme="dark"])
    global.css     Base styles
    *.css          Per-page/per-component styles
  types/           dashboard.ts, projects.ts, users.ts
  pages/           DashboardPage, ProjectsPage, ProjectConfigPage, LoginPage, RegisterPage, RecoverPasswordPage, Calendary

server/            Express backend
  src/index.ts     Server entry (port 3001)
  src/app.ts       Creates Express app with CORS, JSON, routes
  src/config.ts    Reads SUPABASE_URL, SUPABASE_ANON_KEY, PORT, APP_ORIGIN from env
  src/middleware/auth.ts   requireAuth — verifies Supabase JWT
  src/lib/supabase.ts      createAnonClient() / createUserClient(accessToken)
  src/routes/      auth.ts, projects.ts, dashboard.ts, users.ts
  src/lib/         authUser.ts, mappers.ts, projectAccess.ts, projectMembers.ts, projectOwner.ts, roles.ts

supabase/migrations/  7 SQL migrations (001–007)
```

## API conventions

- All routes under `/api/` prefix (proxied by Vite in dev)
- Auth: `Authorization: Bearer <token>` header
- Token stored at `localStorage.classify_access_token`
- 401 auto-clears session and redirects to login
- `apiFetchWithRetry` retries 3× on 502/503/504
- Error shape: `{ error: string }` or `{ message: string }`

## Auth flows

| Endpoint | Notes |
|----------|-------|
| `POST /api/auth/register` | Creates Supabase Auth user + `usuarios` row; role = `alumno` (3) by default |
| `POST /api/auth/login` | Returns `{ accessToken, user }` |
| `GET /api/auth/me` | Validates token, returns user profile |
| `POST /api/auth/recover-password` | Calls Supabase `resetPasswordForEmail` |

## Project ownership rules (important)

| Action | Who can do it |
|--------|--------------|
| List projects | Owner (`proyecto_profesor`) ∪ Member (`grupo_estudiante`) |
| View detail | Anyone with access |
| Create | Any authenticated user (becomes owner) |
| Edit name/desc/status/members | **Owner only** |
| Toggle `anteproyecto_validado` | **Owner with `profesor` role only** (checked in API + UI) |
| Delete | **Owner only** |
| Bulk delete | **Owner only** (sends `{ ids: [] }` to `DELETE /api/projects/bulk`) |
| Toggle favorite | **Owner only** (`PATCH /api/projects/:id/favorite`) |

## Database

- `auth.users` (Supabase Auth) ← 1:1 → `usuarios.id_usuario` (UUID)
- User profile in `usuarios` table (not `auth.users`)
- Roles seed: admin=1, profesor=2, alumno=3
- Projects: `grupos_proyectos` (main), `proyecto_profesor` (owner link), `grupo_estudiante` (members)
- Tasks: `tareas_grupo` (kanban — Pendiente / En Progreso / Completado)
- Documents stored as JSONB in `grupos_proyectos.documentos`
- RPC functions: `create_grupo_proyecto`, `find_user_id_by_email`, `get_group_member_emails`, `search_usuarios_for_invite`, `get_project_owner_email`

## Style conventions

- **CSS vanilla** everywhere — all design tokens in `variables.css`, no inline styles, no hardcoded colors in JSX
- Light mode is default; dark mode via `[data-theme="dark"]` (optional)
- Sidebar collapse state persisted in `localStorage.classify-sidebar-collapsed`
- Tables use semantic `<table>` with `data-label` for mobile (≤768px) stacking
- UI text in Spanish throughout
- No `any` types; prefer explicit interfaces
- Functional components only; ~250 line ceiling before splitting
- Font: system-ui stack (Segoe UI, Roboto, Arial)

## Testing / CI

- No test framework configured yet
- CI: React Doctor workflow (`react-doctor.yml`) — lints React code on PR + push to `main`

## Key files to read first

- `DESIGN.md` — design system spec (Linear-inspired tokens + educational platform override)
- `estructura_db.md` — full database schema (18 tables), RLS, RPC functions
- `docs/supabase-schema.md` — condensed Supabase schema reference
- `CAMBIOS.md` — changelog with implementation history
