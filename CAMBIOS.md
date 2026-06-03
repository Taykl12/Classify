# Registro de cambios — Dashboard Classify

Documento que resume todo lo implementado en el repositorio respecto al dashboard React, según el plan *Dashboard simple (React + mockups)* y las correcciones posteriores de UI/UX.

**Fecha de referencia:** junio 2026

---

## Resumen

Se añadió una aplicación **React + TypeScript + Vite** con **CSS vanilla** (sin Tailwind) que reproduce el dashboard de los mockups: sidebar colapsable, carrusel de proyectos destacados con “peek” lateral y tabla de pendientes con acciones. Los archivos estáticos de login (`Login.html`, `Register.html`) **no se modificaron**.

---

## Stack y dependencias nuevas

| Tecnología | Uso |
|------------|-----|
| React 19 | UI del dashboard |
| TypeScript | Tipado estricto |
| Vite 6 | Dev server y build |
| lucide-react | Iconos (sidebar, carrusel) |
| react-router-dom | Rutas `/` y `/dashboard` |

### Scripts (`package.json`)

- `npm run dev` — servidor de desarrollo
- `npm run build` — compilación de producción (`dist/`)
- `npm run preview` — vista previa del build

### Archivos de configuración creados

- `package.json`, `package-lock.json`
- `vite.config.ts`
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`
- `index.html` (entrada Vite del dashboard)
- `.gitignore` (incluye `node_modules`, `dist`)

---

## Estructura de `src/`

```
src/
├── main.tsx
├── App.tsx
├── vite-env.d.ts
├── types/
│   └── dashboard.ts          # Interfaces + datos mock
├── hooks/
│   ├── useSidebarCollapsed.ts
│   └── useCarouselMetrics.ts
├── pages/
│   └── DashboardPage.tsx
├── components/
│   ├── layout/
│   │   ├── DashboardLayout.tsx
│   │   ├── Sidebar.tsx
│   │   └── SidebarToggle.tsx
│   └── dashboard/
│       ├── FeaturedProjectsCarousel.tsx
│       ├── ProjectCard.tsx
│       └── PendingProjectsSection.tsx
└── styles/
    ├── variables.css
    ├── global.css
    ├── dashboard.css
    ├── sidebar.css
    ├── carousel.css
    └── pending.css
```

---

## Funcionalidades implementadas

### 1. Layout general (`DashboardLayout`)

- Fondo con gradiente alineado al login (`#4162da` → `#89e6eb` → canvas claro).
- Área principal con dos paneles: **Proyectos Destacados** y **Pendientes**.

### 2. Sidebar colapsable

| Estado | Comportamiento |
|--------|----------------|
| Colapsado (~72px) | Solo iconos: perfil, Inicio, Proyectos, Calendario, Preferencias, Cerrar sesión |
| Expandido (~240px) | Bloques blancos con avatar, “Nombre y Apellido - Cargo” y etiquetas de texto |

- **Toggle** circular arriba a la derecha del sidebar (menú / cerrar panel).
- Estado persistido en `localStorage` (`classify-sidebar-collapsed`).
- Accesibilidad: `aria-expanded`, `aria-label`, foco visible, etiquetas `.sr-only` cuando está colapsado.

### 3. Carrusel de proyectos destacados

- Tarjetas blancas con nombre del proyecto.
- Flechas anterior/siguiente; deshabilitadas en los extremos.
- **Peek:** se ve un recorte de la tarjeta vecina al desplazar.
- Ancho del carrusel **dinámico** (`useCarouselMetrics` + `ResizeObserver`): usa todo el espacio del panel y calcula cuántas tarjetas caben (hasta 4).
- Navegación por teclado: flechas ← → con foco en la región del carrusel.
- **10 proyectos** mock para probar el desplazamiento.

### 4. Sección Pendientes (tabla)

Columnas con encabezados:

| Descripción | Proyecto | Prioridad | Estado | Acciones |
|-------------|----------|-----------|--------|----------|
| Texto de ejemplo | Nombre del Proyecto | Alta/Media/Baja | Pendiente/En curso | **Editar** · **Ver** |

- Maquetado con `<table>` semántica.
- Acciones alineadas a la derecha en desktop.
- En móvil (`≤768px`): filas apiladas con `data-label` por celda.

### 5. Rutas

- `http://localhost:5173/` (o el puerto que asigne Vite)
- `http://localhost:5173/dashboard` — misma vista

---

## Tokens de diseño (`variables.css`)

Basados en la sección *Educational Platform Extension* de `DESIGN.md` y el gradiente de `Login.css`:

- Colores: `--color-primary`, `--color-canvas`, `--color-surface`, `--color-border`, `--color-ink`, `--color-panel`, etc.
- Espaciado, radios, anchos de sidebar y carrusel (`--card-width`, `--carousel-peek`, …).

Regla de estilo: **sin colores ni medidas hardcodeadas en JSX**; todo vía clases CSS y variables.

---

## Correcciones de UI (iteración posterior)

Tras la primera versión visual se ajustó lo siguiente:

| Problema | Solución |
|----------|----------|
| Carrusel cortado, no usaba todo el ancho | Viewport al 100%; tarjetas redimensionadas con `useCarouselMetrics` |
| Pocos ítems para probar scroll | 10 proyectos en `FEATURED_PROJECTS` |
| Sidebar colapsado desalineado (toggle/íconos) | `align-items: center`, header centrado, bloques con `max-width` uniforme |
| Recuadro inferior con espacio vacío bajo Cerrar sesión | Eliminado `sidebar__spacer`; quitado `flex: 1` del menú; footer con `margin-top: auto` solo |
| Hueco bajo el sidebar al hacer scroll | `position: sticky`, `min-height: 100vh`, `height: 100vh` |
| Tabla sin nombres de columna | Encabezados `<thead>` con estilo tabla |

---

## Pasos del plan completados

1. Scaffold Vite + React + TS + `lucide-react` (sin Tailwind).
2. `variables.css`, `global.css`, `dashboard.css` + layout base.
3. `sidebar.css` + `Sidebar` + toggle.
4. `carousel.css` + carrusel y datos mock.
5. `pending.css` + sección híbrida (datos + Editar/Ver).
6. `DashboardPage` + media queries responsive.

### Ajustes respecto al plan original

- **CSS:** vanilla en lugar de Tailwind (pedido explícito).
- **Mocks:** en `src/types/dashboard.ts` (el plan los citaba ahí); se eliminó `src/data/mockDashboard.ts`.
- **Router:** añadido `react-router-dom` para `/` y `/dashboard`.

---

## Archivos del repo sin cambios

- `Login.html`, `Login.css`
- `Register.html`, `Register.css`
- `DESIGN.md`
- `.cursor/rules/frontend.mdc` (sigue recomendando Tailwind; el dashboard usa CSS vanilla por decisión del proyecto)

---

## Archivos actualizados (existentes)

| Archivo | Cambio |
|---------|--------|
| `README.md` | Instrucciones para `npm install` y `npm run dev` |

---

## Cómo ejecutar

```bash
npm install
npm run dev
```

Abrir la URL que muestra la terminal (por defecto `http://localhost:5173`; si está ocupado, Vite usa otro puerto, p. ej. `5174`).

Build de producción:

```bash
npm run build
npm run preview
```

---

## Pendiente / fuera de alcance

- Conectar el botón “Iniciar sesión” de `Login.html` al dashboard.
- Backend, autenticación real y API.
- Ordenación/filtrado avanzado en la tabla.
- Rutas adicionales (Proyectos, Calendario, etc.) más allá del placeholder en botones del sidebar.

---

## Fase 2 — Mejoras UI/UX (accesibilidad + rango etario alto)

Implementado según [`PLAN-MEJORAS-UI-UX.md`](PLAN-MEJORAS-UI-UX.md).

### Sidebar
- **Expandido:** toggle de ancho completo con icono + texto **“Ocultar menú”**, centrado.
- **Colapsado:** solo icono hamburguesa; `aria-label="Abrir menú"`.
- Grilla centrada de 48px para toggle, avatar, nav y footer en modo colapsado.
- Menos espacio entre bloques; ancho expandido **260px**.
- Ítem **Inicio** con estado activo (`sidebar__nav-item--active`).

### Tipografía y paneles
- Fuente system-ui (Segoe UI, Roboto, Arial); cuerpo 16px, `line-height: 1.5`.
- Títulos de panel 24px; subtítulo en Pendientes: *“Tareas que requieren tu atención”*.
- Paneles con fondo blanco más opaco y sombra `--shadow-panel`.
- Gradiente de fondo más suave (menos saturación).

### Tabla Pendientes
- Encabezados sin mayúsculas forzadas; color `--color-primary`; 15px.
- **Prioridad** y **Estado** como badges con texto + color (Alta/Media/Baja, Pendiente/En curso).
- **Editar / Ver** como botones con borde y `min-height: 44px`.
- Filas con borde `1px` además de sombra.

### Carrusel
- Tarjetas **125px** de alto con línea secundaria (*“N tareas pendientes”*).
- Borde en tarjetas; hover sutil (respetando `prefers-reduced-motion`).

### Tokens nuevos
- `--color-success-*`, `--color-warning-*`, `--color-error-*`, `--color-neutral-*`
- `--shadow-panel`, `--touch-min`, `--font-size-*`, `--card-height`

### Tipos
- `Project.pendingTasks` y uniones literales en `PendingItem.priority` / `status`.

---

## Nota sobre pruebas en navegador

Validar en `npm run dev`: toggle “Ocultar menú”, alineación colapsada, badges, botones 44px, carrusel y scroll con sidebar sticky a altura completa.
