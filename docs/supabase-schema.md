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
| GET | `/api/calendar/events` | Eventos accesibles + vencimientos de tareas (`type: "event" \| "task"`) |
| POST | `/api/calendar/events` | Crear evento (valida prioridad, fecha y horas) |
| PATCH | `/api/calendar/events/:id` | Editar evento |
| DELETE | `/api/calendar/events/:id` | Eliminar evento |
| GET | `/api/calendar/events/export.ics` | Exportar eventos filtrados (`.ics`) |

Tabla: `eventos_calendario` (+ `hora_inicio`, `hora_fin`, `recurrencia`).
RPC `create_evento_calendario`. Policies con `can_view_proyecto` / `can_manage_proyecto`.
Migraciones: `011`, `022`.

## Favoritos de proyectos

`proyecto_favorito` (un favorito por usuario). `PATCH /api/projects/:id/favorite` para
cualquier usuario con acceso; `GET /api/dashboard/featured` y `GET /api/projects` usan
los favoritos del usuario. Migración: `022`.

## API tareas de proyecto

| Método | Ruta | Acción |
|--------|------|--------|
| GET | `/api/tasks/:projectId` | Listar tareas del proyecto |
| POST | `/api/tasks` | Crear tarea (`projectId`, `title`, `priority`, `deadline?`) |
| PATCH | `/api/tasks/:taskId` | Editar tarea (incluye `status`) |
| DELETE | `/api/tasks/:taskId` | Eliminar tarea |

Tabla `tareas_grupo`. Acceso: dueño, integrante, profesor asignado o admin
(`can_view_proyecto`). Migraciones: `010`, `023`. UI: `/proyectos/:id/tareas`.

## API notas diarias

| Método | Ruta | Acción |
|--------|------|--------|
| GET | `/api/projects/:id/calificaciones` | Notas por integrante + promedio |
| POST | `/api/projects/:id/calificaciones` | Agregar nota (nota, descripción, fecha) |
| PATCH | `/api/projects/:id/calificaciones/:gradeId` | Editar nota |
| DELETE | `/api/projects/:id/calificaciones/:gradeId` | Eliminar nota |

Tabla `calificaciones_proyecto` (varias notas por alumno). Migraciones: `019`, `023`.

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

`admin`, `profesor`, `alumno`. No hay registro público: un administrador crea cada usuario
desde `/admin/usuarios` y elige su rol.

## RLS (migración aplicada)

Políticas `authenticated` para `usuarios`, `proyecto_profesor`, `grupos_proyectos`, `tareas_grupo`, `eventos_calendario`; `roles` legible por `anon` y `authenticated`.
