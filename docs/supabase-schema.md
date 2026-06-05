# Esquema Supabase — Classify (`jgrtmokyqdvdxsldmkou`)

## UI → tablas

| Vista | Tablas |
|-------|--------|
| `/proyectos` | `grupos_proyectos` + `proyecto_profesor` |
| Carrusel | `grupos_proyectos` + `tareas_grupo` (conteo no completadas) |
| Pendientes | `tareas_grupo` + `grupos_proyectos.nombre_proyecto` |
| Auth perfil | `usuarios` (`id_usuario` = `auth.users.id`) |
| Login | Supabase Auth (email en `auth.users`) |

## Columnas añadidas (migración 001)

- `grupos_proyectos.estado_proyecto` (`Abierto` | `Cerrado`) — al crear siempre `Abierto`
- `grupos_proyectos.es_favorito` (boolean) — carrusel del inicio

## API proyectos

| Método | Ruta | Acción |
|--------|------|--------|
| GET | `/api/projects` | Listado del usuario |
| GET | `/api/projects/:id` | Detalle + emails integrantes |
| POST | `/api/projects` | Crear (`memberEmails[]`) + `grupo_estudiante` |
| PUT | `/api/projects/:id` | Editar nombre e integrantes |
| PATCH | `/api/projects/:id/favorite` | Favorito (carrusel) |
| DELETE | `/api/projects/:id` | Borrar uno |
| DELETE | `/api/projects/bulk` | Borrar selección `{ ids: [] }` |

Carrusel: `GET /api/dashboard/featured` solo proyectos con `es_favorito = true`.

## Mappers API

- `estado_tarea`: `En Progreso` → `En curso`
- `id_grupo` / `id_tarea` → string en JSON

## Roles seed

`admin`, `profesor`, `alumno` — registro asigna `profesor` por defecto.

## RLS (migración aplicada)

Políticas `authenticated` para `usuarios`, `proyecto_profesor`, `grupos_proyectos`, `tareas_grupo`; `roles` legible por `anon` y `authenticated`.
