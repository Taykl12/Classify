# Plan: Mejoras UI/UX del dashboard (fase 2)

> Refinamiento visual orientado a **usuarios de edad avanzada**: más atractivo y ordenado **sin reducir** contraste, tamaños táctiles ni claridad semántica.  
> Incluye el toggle del sidebar expandido como **botón ancho con icono + texto**.

---

## Contexto y restricciones

**Base actual:** [`src/styles/`](src/styles/), [`Sidebar.tsx`](src/components/layout/Sidebar.tsx), [`CAMBIOS.md`](CAMBIOS.md).

**Problemas visibles en tus capturas:**

| Área | Problema |
|------|----------|
| Sidebar colapsado | Perfil y toggle desalineados respecto a otros iconos |
| Sidebar expandido | Toggle flotante a la derecha; bloques con mucho espacio vacío; menú pegado a la izquierda |
| Carrusel | Tarjetas muy altas con poco contenido; sensación de corte en el borde derecho |
| Tabla | Encabezados pequeños, grises y en MAYÚSCULAS — baja legibilidad |

**Principios ( [`DESIGN.md`](DESIGN.md) — plataforma educativa):**

| Hacer | Evitar |
|-------|--------|
| Más contraste en textos secundarios | Gris claro sobre fondo claro |
| Cuerpo ≥ 16px; metadatos ≥ 14px | Headers de tabla &lt; 14px en mayúsculas |
| Áreas táctiles ≥ 44×44px | Controles sin etiqueta visible (salvo colapsado + `aria-label`) |
| Jerarquía con peso, espacio y color | Animaciones llamativas, efectos “startup” |
| Badges con **texto + color** | Solo color para transmitir información |

**Fuera de alcance:** APIs, auth, rutas nuevas, cambios en `Login.html`.

---

## Diagnóstico visual

```
Sidebar colapsado  →  grilla única 48px centrada
Sidebar expandido  →  toggle ancho "Ocultar menú" + ítems full-width
Tabla              →  headers más grandes/oscuras + badges + botones
Carrusel           →  cards más bajas con detalle
Paneles            →  más contraste sobre el gradiente
```

---

## 1. Sidebar — toggle expandido (prioridad tuya)

### Colapsado (imagen 1)
- Mantener botón **solo icono** (hamburguesa).
- `aria-label="Abrir menú"` (sin cambiar accesibilidad).

### Expandido (imagen 2)
- Sustituir el círculo flotante por un control **de ancho completo**:

```
┌─────────────────────────────┐
│   [←]   Ocultar menú        │   icono + texto, centrados
└─────────────────────────────┘
```

**Archivos:** [`SidebarToggle.tsx`](src/components/layout/SidebarToggle.tsx), [`sidebar.css`](src/styles/sidebar.css)

- Clases: `sidebar__toggle--collapsed` | `sidebar__toggle--expanded`
- Expandido: `width: 100%`, `min-height: 44px`, `border-radius: var(--radius-md)`, flex centrado, gap entre icono y texto
- Header expandido: `justify-content: stretch` (no alinear el toggle a la derecha)

---

## 2. Sidebar — estructura y alineación

### Modo colapsado
- Una sola **columna centrada** de 48px para: toggle, avatar, nav, footer.
- Misma anchura/padding/radius en todas las “cápsulas” blancas.
- Avatar y toggle **no** más grandes que el resto de iconos.

### Modo expandido
- Menos espacio entre bloques (profile / nav / footer): p. ej. 12px en lugar de 16px.
- Ítems de menú al **100%** del bloque, padding simétrico.
- Estado activo mock en “Inicio”: `sidebar__nav-item--active` (borde izquierdo 3px + fondo panel).
- Ancho sidebar: **240px → 260px** en `variables.css` para texto + toggle sin apretar.

### Opcional (misma fase si hay tiempo)
- Unificar los 3 bloques blancos en **un solo panel** con divisores internos (`border-bottom`), como el mock original.

---

## 3. Tipografía global

**Archivos:** [`variables.css`](src/styles/variables.css), [`global.css`](src/styles/global.css), [`dashboard.css`](src/styles/dashboard.css)

| Elemento | Propuesta |
|----------|-----------|
| Cuerpo | 16px (`1rem`), `line-height: 1.5` |
| Título de panel | 1.5rem (24px), peso 700 |
| Headers tabla | 15px, color oscuro (no gris tenue) |
| Fuente | system-ui: Segoe UI, Roboto, Arial |

- Subtítulo bajo “Pendientes”: texto muted corto (“Tareas que requieren tu atención”) — contexto extra para orientación.

---

## 4. Tabla de pendientes

**Archivos:** [`pending.css`](src/styles/pending.css), [`PendingProjectsSection.tsx`](src/components/dashboard/PendingProjectsSection.tsx)

### Encabezados (crítico para rango etario alto)
- Eliminar `text-transform: uppercase`.
- Color `--color-ink` o `--color-primary` (no solo `--color-ink-muted`).
- Tamaño mínimo **15px**.

### Filas
- **Prioridad** y **Estado** como badges pill (fondo suave + texto): Alta/Media/Baja, Pendiente/En curso — colores de DESIGN (`success`, `warning`, neutro).
- **Editar / Ver:** botones secundarios con `min-height: 44px`, borde visible — mejor que links sueltos; mantener foco y contraste.

### Contenedor
- Borde `1px solid var(--color-border)` en filas además de sombra suave.

---

## 5. Carrusel de proyectos destacados

**Archivos:** [`carousel.css`](src/styles/carousel.css), [`ProjectCard.tsx`](src/components/dashboard/ProjectCard.tsx)

- Altura de tarjeta: **160px → ~125px** (menos vacío).
- Segunda línea bajo el título (mock): p. ej. “3 tareas pendientes” en 14px muted.
- Borde sutil + sombra; hover ligero con `prefers-reduced-motion: reduce` para desactivar movimiento.
- Flechas: mantener 48px (ya cumplen táctil).
- Acercar carrusel al título del panel (menos margen inferior del `h2`).

---

## 6. Paneles y fondo

**Archivo:** [`dashboard.css`](src/styles/dashboard.css)

- Paneles: fondo blanco más opaco (`rgba(255,255,255,0.85)`) para mayor contraste sobre el gradiente.
- Sombra `--shadow-panel` un poco más definida.
- Gradiente de fondo: transición más suave (menos saturación intermedia) — contenido blanco como protagonista.

---

## 7. Nuevos tokens CSS

En [`variables.css`](src/styles/variables.css) (sin colores en JSX):

```css
--color-success-bg: #dcfce7;
--color-success-text: #166534;
--color-warning-bg: #fef3c7;
--color-warning-text: #92400e;
--color-neutral-bg: #f1f5f9;
--shadow-panel: 0 8px 24px rgba(30, 58, 95, 0.1);
--sidebar-width-expanded: 260px;
--touch-min: 44px;
```

---

## 8. Verificación

Tras implementar, probar en **navegador integrado**:

1. Sidebar colapsado: columna de iconos alineada.
2. Sidebar expandido: “Ocultar menú” ancho y centrado.
3. Headers de tabla legibles de un vistazo.
4. Editar/Ver ≥ 44px de alto.
5. Carrusel: menos altura vacía; peek lateral OK.
6. `prefers-reduced-motion`: sin animaciones si el usuario lo tiene activo.
7. Tab + Enter en toggle y navegación.

Actualizar [`CAMBIOS.md`](CAMBIOS.md) con sección “Fase 2 — UI/UX”.

---

## Archivos a modificar

| Archivo | Cambio principal |
|---------|------------------|
| `SidebarToggle.tsx` | Toggle expandido icono + texto |
| `sidebar.css` | Alineación, toggle ancho, activo, espaciado |
| `variables.css` | Tokens badges, sombra, ancho sidebar |
| `global.css` | Font stack, line-height |
| `dashboard.css` | Paneles, títulos, gradiente |
| `pending.css` + `PendingProjectsSection.tsx` | Headers, badges, botones |
| `carousel.css` + `ProjectCard.tsx` | Cards compactas |
| `CAMBIOS.md` | Documentación |

---

## Orden de implementación

1. Tokens + tipografía global  
2. **Toggle sidebar** (expandido / colapsado)  
3. Alineación y espaciado del sidebar  
4. Tabla pendientes (headers + badges + botones)  
5. Carrusel y tarjetas  
6. Paneles y fondo  
7. Verificación en navegador + `CAMBIOS.md`

---

## Checklist de todos

- [ ] `tokens-typography` — variables y global.css  
- [ ] `sidebar-toggle-expanded` — icono + “Ocultar menú”  
- [ ] `sidebar-alignment` — grilla colapsada y espaciado expandido  
- [ ] `pending-table-polish` — headers, badges, botones 44px  
- [ ] `carousel-cards` — altura y detalle visual  
- [ ] `panels-background` — contraste de paneles y gradiente  
- [ ] `browser-verify-docs` — prueba visual y documentación  
