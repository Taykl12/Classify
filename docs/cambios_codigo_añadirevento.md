# Cambios de código — Añadir Evento en Calendario

Documento para que el desarrollador original pueda revisar qué se modificó en su código y por qué.

**Fecha:** 16/06/2026  
**Objetivo:** Separar eventos de calendario de tareas Kanban; renombrar UI de "tarea" a "evento"; eliminar selector de fecha límite.

---

## Resumen del cambio

| Antes | Después |
|-------|---------|
| Calendario leía `tareas_grupo.fecha_limite` | Calendario lee `eventos_calendario.fecha_evento` |
| Formulario "Nueva tarea" con campo "Fecha límite" | Formulario "Nuevo evento" con fecha fija del día |
| `POST /api/tasks` | `POST /api/calendar/events` |
| `TaskFormModal.tsx` | `EventFormModal.tsx` |
| `CalendarEvent.type: "task" \| "delivery"` | `CalendarEvent.type: "event"` |

**Decisión de BD:** Se creó tabla nueva `eventos_calendario` en lugar de reutilizar `tareas_grupo`, porque las tareas siguen siendo entidad Kanban/pendientes y no deben mezclarse con eventos de calendario.

---

## Archivos nuevos

### `supabase/migrations/011_eventos_calendario.sql`

- Crea tabla `eventos_calendario` con columnas:
  - `id_evento`, `id_grupo`, `titulo_evento`, `descripcion_evento`, `fecha_evento`, `prioridad_evento`, `id_creado_por`, `fecha_creacion`
- Habilita RLS con políticas SELECT e INSERT para dueño o integrante del proyecto.
- Crea RPC `create_evento_calendario(...)` (SECURITY DEFINER, mismo patrón que `create_tarea_grupo`).

### `src/components/calendar/EventFormModal.tsx`

- Reemplaza a `TaskFormModal.tsx`.
- Props: `eventDate` (obligatorio), `onClose`, `onEventCreated`.
- Campos: título, proyecto, descripción, prioridad.
- **Eliminado:** input de "Fecha límite".
- Muestra la fecha del evento como texto informativo (`task-form__date-hint`).
- Envía `POST /api/calendar/events` con `{ projectId, title, description?, priority, eventDate }`.

### `docs/cambios_codigo_añadirevento.md`

- Este archivo.

---

## Archivos eliminados

### `src/components/calendar/TaskFormModal.tsx`

- Eliminado porque fue reemplazado por `EventFormModal.tsx`.
- Antes llamaba a `POST /api/tasks` con campo `deadline`.

---

## Archivos modificados

### `src/pages/Calendary.tsx`

| Cambio | Detalle |
|--------|---------|
| Import | `TaskFormModal` → `EventFormModal` |
| Estado | `showTaskForm` / `taskFormDate` → `showEventForm` / `eventFormDate` |
| Botón cabecera | "Nueva tarea" → "Añadir evento"; abre formulario con fecha de hoy |
| Botón modal día | "Agregar tarea" → "Añadir evento" |
| Clic en día vacío | Sigue abriendo formulario con la fecha del día clickeado |
| Render modal | Pasa `eventDate` obligatorio; ya no acepta `null` |
| `useEffect` fetch | Eliminada variable `cancelled` sin uso (error TS6133 en build) |

### `server/src/routes/calendar.ts`

| Cambio | Detalle |
|--------|---------|
| `GET /events` | Consulta `eventos_calendario` en lugar de `tareas_grupo` |
| Mapeo | `id_evento`, `titulo_evento`, `fecha_evento`, `prioridad_evento` |
| `type` | Siempre `"event"` (antes `"task"`) |
| **Nuevo** `POST /events` | Valida `projectId`, `title`, `eventDate`; llama RPC `create_evento_calendario` |
| Eliminado del response | Campo `status` (no aplica a eventos) |

### `src/types/calendar.ts`

- `CalendarEvent.type`: `"task" | "delivery"` → `"event"`.
- Eliminado `status?` del interface (eventos no tienen estado Kanban).

### `src/styles/Calendary.css`

- Añadido `.task-form__date-hint` para mostrar la fecha fija del evento en el formulario.

### `docs/calendario-guia.txt`

- Actualizada toda la guía: eventos en lugar de tareas, nuevo endpoint POST, nueva tabla y migración 011.

### `docs/supabase-schema.md`

- Añadida fila `/calendario` → `eventos_calendario`.
- Añadida sección API calendario.
- RLS incluye `eventos_calendario`.

---

## Archivos NO modificados (intencionalmente)

| Archivo | Motivo |
|---------|--------|
| `server/src/routes/tasks.ts` | Sigue sirviendo para tareas Kanban futuras |
| `supabase/migrations/010_create_tarea_rpc.sql` | RPC de tareas intacto |
| `server/src/routes/dashboard.ts` | Pendientes y carrusel siguen usando `tareas_grupo` |
| `server/src/app.ts` | Rutas `/api/calendar` y `/api/tasks` ya montadas |

---

## Migración en Supabase remoto

Se aplicó la migración `eventos_calendario` al proyecto `jgrtmokyqdvdxsldmkou` vía MCP.

Para otros entornos, ejecutar manualmente:

```
supabase/migrations/011_eventos_calendario.sql
```

---

## Flujo anterior vs nuevo

```
ANTES:
  Calendary → TaskFormModal → POST /api/tasks → create_tarea_grupo → tareas_grupo.fecha_limite
  Calendary → GET /api/calendar/events ← tareas_grupo (WHERE fecha_limite IS NOT NULL)

DESPUÉS:
  Calendary → EventFormModal → POST /api/calendar/events → create_evento_calendario → eventos_calendario.fecha_evento
  Calendary → GET /api/calendar/events ← eventos_calendario
```

---

## Cómo probar

1. Ejecutar migración 011 en Supabase (si no está aplicada).
2. `npm run dev:server` + `npm run dev`.
3. Ir a `/calendario`.
4. Clic en un día vacío → formulario "Nuevo evento" sin campo de fecha límite.
5. Botón "Añadir evento" (cabecera) → crea evento para hoy.
6. Verificar que el evento aparece en la grilla y en "Eventos del día".
