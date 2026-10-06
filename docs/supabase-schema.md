# Esquema Supabase — Classify (`jgrtmokyqdvdxsldmkou`)

## UI → tablas

| Vista | Tablas |
|-------|--------|
| `/proyectos` | `grupos_proyectos` + `proyecto_profesor` |
| `/calendario` | `eventos_calendario` + `grupos_proyectos.nombre_proyecto` |
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

## API calendario

| Método | Ruta | Acción |
|--------|------|--------|
| GET | `/api/calendar/events` | Eventos de proyectos accesibles |
| POST | `/api/calendar/events` | Crear evento (`eventDate` obligatorio) |

Tabla: `eventos_calendario` — RPC `create_evento_calendario`.
Migración: `011_eventos_calendario.sql`.

## API asistencia de profesores (huella)

| Método | Ruta | Acción |
|--------|------|--------|
| POST | `/api/device/esp32/asistencia` | Marcación del ESP32 (`X-Device-Token`, `{ fingerprint_id }`) |
| GET | `/api/admin/asistencia-profesores?fecha=` | Listado del día + resumen |
| GET | `/api/admin/asistencia-profesores/:userId/historial` | Historial reciente |
| POST | `/api/admin/asistencia-profesores/:userId/correccion` | Corrección manual auditada |
| GET/PUT | `/api/admin/asistencia-profesores/config` | Configuración de horario |

Tablas: `asistencias_profesores`, `asistencias_profesores_ajustes`, `configuracion_asistencia`.
Migración: `021_asistencia_profesores.sql`.

## Mappers API

- `estado_tarea`: `En Progreso` → `En curso`
- `id_grupo` / `id_tarea` → string en JSON

## Roles seed

`admin`, `profesor`, `alumno` — registro asigna `profesor` por defecto.

## RLS (migración aplicada)

Políticas `authenticated` para `usuarios`, `proyecto_profesor`, `grupos_proyectos`, `tareas_grupo`, `eventos_calendario`; `roles` legible por `anon` y `authenticated`.
