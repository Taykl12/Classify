# Calendario — cambios respecto al código original

Documento local de referencia. Explica qué se modificó en `Calendary.tsx` y `Calendary.css` tras los ajustes de diseño (cabecera compacta, botones, grilla completa, fines de semana en rojo).

**Ruta:** `/calendario`

---

## Resumen

| Archivo | Original | Actual |
|---------|----------|--------|
| `src/pages/Calendary.tsx` | ~117 líneas, lógica inline | ~150 líneas, grilla extraída a función |
| `src/styles/Calendary.css` | ~79 líneas, estilos mínimos | ~194 líneas, layout flex + botones + estados de día |

Los cambios responden a cuatro pedidos concretos:

1. Cabecera más arriba para ver el mes completo sin scroll.
2. Botones alineados al diseño de la app, más grandes.
3. Celdas vacías rellenadas con días del mes anterior/siguiente (estilo Google Calendar).
4. Números de sábado y domingo en rojo.

---

## `Calendary.tsx`

### Imports

**Original:**
```tsx
import {useState} from "react";
import { DashboardLayout } from "../components/layout/DashboardLayout";
```

**Actual:**
```tsx
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DashboardLayout } from "../components/layout/DashboardLayout";
```

**Por qué:** `lucide-react` es el sistema de iconos del resto del proyecto. Reemplaza `"<"` y `">"` por chevrones consistentes con la UI.

---

### Construcción de la grilla

**Original** — arreglo `(number | null)[]` construido dentro del componente:

```tsx
const celdas: (number | null)[] = [];

for (let i = 1; i < primerDiaSemana; i++) {
  celdas.push(null);
}

for (let dia = 1; dia <= diasDelMes; dia++) {
  celdas.push(dia);
}

while (celdas.length < 42) {
  celdas.push(null);
}
```

**Actual** — función `buildCalendarCells()` con tipo `CalendarCell`:

```tsx
interface CalendarCell {
  day: number;
  monthOffset: -1 | 0 | 1; // mes anterior, actual o siguiente
}
```

| Aspecto | Original | Actual |
|---------|----------|--------|
| Celdas iniciales vacías | `null` | Días finales del mes anterior (gris) |
| Celdas finales vacías | `null` | Días 1, 2, 3… del mes siguiente (gris) |
| Cantidad de filas | Siempre 42 celdas (6 semanas) | Solo las filas necesarias (`Math.ceil`) |
| Identidad del día | Solo el número; mes implícito | Número + `monthOffset` |

**¿Era necesaria la extracción?** No estrictamente para el diseño actual. Sí facilita saber a qué mes pertenece cada celda (útil para eventos con clic en casilla).

---

### Render de cada celda

- Siempre se muestra un número (también en días de otro mes).
- `esHoy` solo si `monthOffset === 0`.
- `esFinDeSemana` con `index % 7 >= 5` (semana empieza en lunes).
- Clases: `day-number--other-month`, `day-number--weekend`, `day-number--today`.

`.filter(Boolean).join(" ")` en las clases: elimina condiciones falsas del array y arma un solo `className`.

---

### Botones y cabecera

- Clases `calendar-btn`, `calendar-btn--today`, `calendar-btn--nav`.
- `type="button"`, `aria-label` en flechas, iconos Lucide.
- Wrapper `calendar-body` para layout flex (opcional, solo CSS).

---

## `Calendary.css`

### Cambios principales

| Área | Qué cambió |
|------|------------|
| `.calendary-page` | `flex: 1`, menos padding, columna flex |
| `.calendar-container` | Sin padding extra de 20px; crece con flex |
| Botones | Estilo pill alineado a proyectos (`--touch-min` 44px) |
| `.day-cell` | Sin `height: 120px` fijo; filas con `grid-auto-rows: 1fr` |
| Fines de semana | `--calendary-weekend-color` rojo |
| Responsive | `@media (max-width: 768px)` |

Objetivo: ver el mes entero sin scroll vertical.

---

## Cambios necesarios vs. opcionales

| Cambio | ¿Necesario? | Notas |
|--------|-------------|-------|
| Reducir padding / flex layout | **Sí** | Ver mes sin scroll |
| Estilos de botones + Lucide | **Sí** | Diseño de la app |
| Rellenar celdas con otro mes | **Sí** | Comportamiento tipo Google |
| Fines de semana en rojo | **Sí** | CSS + `esFinDeSemana` |
| `buildCalendarCells()` + `CalendarCell` | Opcional | Útil para eventos futuros |
| Wrapper `.calendar-body` | Opcional | Solo organización CSS |
| Días del mes anterior visibles | Extra | Grilla completa como Google |

---

## Próximo paso previsto (eventos)

Lo que ya ayuda:

- `monthOffset` → fecha real: `new Date(año, mes + monthOffset, celda.day)`.
- `buildCalendarCells()` como punto único para adjuntar eventos.

Lo que falta:

- `onClick` en `.day-cell`.
- Modal / popover de creación.
- API y render de eventos en celdas.

---

## Archivos tocados

- `src/pages/Calendary.tsx`
- `src/styles/Calendary.css`

**Migraciones:** ninguna.
