# Panel de profesor y asistencia

Documentación del módulo académico para usuarios con rol **profesor**: panel principal, cursos asignados, listado de alumnos y toma de asistencia.

**Rutas base:** `/profesor`, `/profesor/cursos`, `/profesor/asistencia`  
**Acceso:** solo usuarios con `roleLabel = "profesor"`. Admin y alumnos no ven este menú.

> Complementa: [`migraciones.md`](./migraciones.md) (tablas `cursos`, `materias`, `asistencias`), [`codigo.md`](./codigo.md) (arquitectura general).

---

## Qué puede hacer un profesor

| Sección | Qué muestra | ¿Puede editar? |
|---------|-------------|----------------|
| **Panel** | Resumen: cantidad de cursos y alumnos totales | No |
| **Mis Cursos** | Tabla de cursos asignados (año, división, orientación) | No |
| **Detalle de curso** | Alumnos del curso (nombre, DNI) | No (solo lectura) |
| **Asistencia** | Misma lista de cursos, con acceso al historial | Sí (tomar asistencia) |
| **Historial por curso** | Fechas registradas y ratio `presentes/total` | Ver resumen por fecha |

El profesor **no** ve Proyectos ni Calendario en el sidebar: tiene un menú propio (`Panel`, `Mis Cursos`, `Asistencia`).

Al iniciar sesión, un profesor aterriza en `/profesor` (no en `/dashboard`). Eso lo resuelve `landingRouteForRole()` en `src/lib/roles.ts`.

---

## Cómo se asigna un profesor a un curso

Un profesor ve un curso si está vinculado por **cualquiera** de estas dos vías:

```
Vía A — Asignación directa al curso
  cursos_usuarios_asignados
    id_usuario = profesor
    rol_en_curso = 'profesor'

Vía B — Asignación a una materia del curso (flujo habitual del admin)
  materia_profesor → materias → cursos
    id_profesor = profesor
    materias.id_curso = curso
```

**Importante:** si desde el panel admin solo asignás el profesor a una **materia** (sin agregarlo al curso como usuario), igual debe aparecer el curso. La función `getProfessorCourseIds()` en el backend une ambas fuentes.

Los **alumnos** del curso salen siempre de `cursos_usuarios_asignados` con `rol_en_curso = 'alumno'`.

---

## Navegación y rutas

| Ruta | Página | Archivo |
|------|--------|---------|
| `/profesor` | Panel principal | `ProfessorDashboardPage.tsx` |
| `/profesor/cursos` | Listado de cursos | `ProfessorCoursesPage.tsx` |
| `/profesor/cursos/:courseId` | Alumnos del curso | `ProfessorCourseDetailPage.tsx` |
| `/profesor/asistencia` | Cursos para asistencia | `ProfessorAttendancePage.tsx` |
| `/profesor/asistencia/:courseId` | Historial + tomar asistencia | `ProfessorAttendanceCoursePage.tsx` |

Todas las rutas están envueltas en `<ProfessorRoute>` (`src/components/auth/ProfessorRoute.tsx`), que redirige a `/dashboard` si el usuario no es profesor.

Constantes de paths en `src/routes.ts` (`PROFESSOR`, `PROFESSOR_COURSES`, `professorCourse(id)`, etc.).

---

## Flujo de asistencia

```
1. Profesor entra a /profesor/asistencia/:courseId
2. Ve tabla de historial (vacía al inicio) + botón "Tomar asistencia"
3. Abre AttendanceModal con la lista de alumnos del curso
4. Por defecto todos están en Ausente (A)
5. Marca Presente (P) o Tardanza (L) a quien corresponda
6. Opcional: comentario por alumno
7. "Subir" → POST /api/professor/cursos/:id/asistencias
8. Se guarda en tabla asistencias (una fila por alumno y fecha)
9. El historial muestra la fila: fecha + "24/33"
10. "Ver resumen" abre modal con detalle alumno por alumno
```

### Cómo se cuenta "asistió"

En el ratio del historial (`24/33`), el numerador suma alumnos con estado **Presente** o **Tardanza**. **Ausente** no cuenta.

Si se vuelve a tomar asistencia el **mismo día**, el backend borra los registros de esa fecha y los reemplaza (no duplica).

---

## API del profesor

Prefijo: `/api/professor`. Middleware: `requireAuth` + `requireProfessor`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/summary` | `{ courses, students }` para el panel |
| `GET` | `/cursos` | Lista de cursos asignados al profesor |
| `GET` | `/cursos/:id/alumnos` | Curso + lista de alumnos |
| `GET` | `/cursos/:id/asistencias` | Historial agrupado por fecha |
| `GET` | `/cursos/:id/asistencias/:fecha` | Detalle de un día (`YYYY-MM-DD`) |
| `POST` | `/cursos/:id/asistencias` | Guardar o reemplazar asistencia de un día |

### Body de `POST` asistencias

```json
{
  "fecha": "2026-06-17",
  "registros": [
    { "id_usuario": "uuid", "estado": "Presente", "observaciones": "opcional" }
  ]
}
```

Estados válidos: `Presente`, `Ausente`, `Tardanza`, `Justificado` (en la UI del modal solo se usan P/A/L).

---

## Backend — funciones que conviene conocer

Archivo principal: `server/src/routes/professor.ts`.

### `getProfessorCourseIds(supabase, professorId)`

Devuelve los IDs de curso que el profesor puede ver. Consulta:

1. `cursos_usuarios_asignados` con rol `profesor`
2. `materia_profesor` unido a `materias` para obtener el `id_curso` de cada materia que dicta

Unifica ambos resultados en un `Set` (sin duplicados). Es la base de **Mis Cursos**, **Asistencia** y el panel.

### `assertProfessorInCourse(supabase, professorId, courseId)`

Comprueba que el `courseId` pedido esté en la lista de `getProfessorCourseIds`. Si no, responde 403 (`Curso no asignado`). Se usa antes de listar alumnos, historial o guardar asistencia.

### `listProfessorCourses(supabase, professorId)`

Arma el DTO de cada curso: nombre compuesto, año, división, orientación y cantidad de alumnos. El nombre legible lo arma `composeCourseName()` (misma lógica que el panel admin).

### `mapStudent(row)`

Traduce una fila de `usuarios` al formato del frontend: `firstName`, `lastName`, `dni`, `profilePhotoUrl`.

### Historial (`GET .../asistencias`)

Lee todas las filas de `asistencias` del curso, agrupa por `fecha` y cuenta cuántos tienen estado Presente o Tardanza. El `total` de cada sesión es la cantidad de alumnos del curso al momento de la consulta.

### Detalle (`GET .../asistencias/:fecha`)

Devuelve cada alumno con su estado y observaciones para un día puntual. Alimenta el modal **Ver resumen**.

---

## Frontend — archivos y helpers

### Tipos — `src/types/professor.ts`

Interfaces compartidas: `ProfessorCourse`, `ProfessorStudent`, `AttendanceSession`, `AttendanceRecordDetail`, etc.

### Display — `src/lib/professorDisplay.ts`

Funciones de presentación (no llaman a la API):

| Función | Para qué sirve |
|---------|----------------|
| `studentFullName` | `"Apellido, Nombre"` para tablas |
| `studentInitials` | Iniciales si no hay foto |
| `courseYearLabel` | Ej. `1° — Ciclo Básico` (reusa `adminAcademic`) |
| `courseOrientationLabel` | Ej. `T.E.P` o `Ciclo Básico` |
| `formatAttendanceDate` | Fecha larga en español para el historial |
| `todayIsoDate` | Fecha de hoy en `YYYY-MM-DD` al tomar asistencia |

### `AttendanceModal.tsx`

Modal para **tomar** asistencia. Estado local por alumno (`Presente` / `Ausente` / `Tardanza`). Al abrir, inicializa todos en **Ausente**. Al confirmar, hace `POST` y notifica a la página padre para refrescar el historial.

### `AttendanceSummaryModal.tsx`

Modal de **solo lectura**. Al abrir, pide `GET .../asistencias/:fecha` y muestra tabla con alumno, badge de estado y comentarios.

### Estilos — `src/styles/professor.css`

Extiende patrones de `admin.css` (tablas, hero, badges P/A/L). Usa tokens de `variables.css`, no la paleta del mock en `diseño_asistencia/`.

---

## Base de datos relacionada

| Tabla | Rol en este módulo |
|-------|-------------------|
| `cursos` | Año (`anio_lectivo`), división, orientación (`especialidad`) |
| `cursos_usuarios_asignados` | Alumnos del curso; también asignación directa de profesor |
| `materias` | Materias por curso |
| `materia_profesor` | Profesor asignado a cada materia |
| `asistencias` | Un registro por alumno, curso y fecha |

Migraciones relevantes: `012_admin_academic_schema.sql`, `013_curso_division_materia_horario.sql`, `014_asistencias.sql`. Ver [`migraciones.md`](./migraciones.md).

---

## Permisos y cliente Supabase

El router de profesor usa `createAdminClient()` (service role), no el cliente con JWT del usuario. Las restricciones de acceso están en el código Express (`requireProfessor`, `assertProfessorInCourse`), no en RLS de Postgres para estas rutas.

---

## Checklist al extender el módulo

1. Nueva ruta → `routes.ts`, `App.tsx`, `ProfessorRoute`, y si aplica entrada en `PROFESSOR_NAV` del sidebar.
2. Nuevo endpoint → `server/src/routes/professor.ts`, validar siempre con `assertProfessorInCourse` cuando el recurso sea un curso.
3. Si cambia la lógica de “a qué curso tiene acceso un profesor”, modificar **solo** `getProfessorCourseIds` para no desincronizar listados y permisos.
4. Cambio de esquema en `asistencias` → migración SQL + actualizar este doc y `migraciones.md`.

---

## Historial de cambios del módulo

| Fecha | Cambio |
|-------|--------|
| 2026-06 | Panel profesor, cursos, alumnos, asistencia con persistencia en BD |
| 2026-06 | Cursos visibles también por asignación en `materia_profesor` |
| 2026-06 | Predeterminado en modal: Ausente; botón "Ver resumen" en historial |
