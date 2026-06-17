# Proyecto Classify

Aplicación **React + TypeScript + Vite** (CSS vanilla) con API **Express** y **Supabase** (proyecto Classify `jgrtmokyqdvdxsldmkou`).

## Desarrollo local

1. Copiá `server/.env.example` a `server/.env` y completá `SUPABASE_ANON_KEY` (Dashboard → Settings → API).
2. Instalá dependencias: `pnpm install` (monorepo: frontend + server).
3. En una terminal: `pnpm run dev:server` (API en `http://localhost:3001`).
4. En otra: `pnpm run dev` (front en `http://localhost:5173`).

El proxy de Vite reenvía `/api` al servidor Express.

## Rutas

| Ruta | Vista |
|------|--------|
| `/` | Redirige a login |
| `/login` | Iniciar sesión (email + contraseña) |
| `/register` | Registro |
| `/recuperar-contrasena` | Recuperar contraseña |
| `/dashboard` | Inicio (protegida) |
| `/proyectos` | Listado de proyectos (protegida) |

## Build

```bash
pnpm run build
pnpm run build:server
```



[Ver cambios](CAMBIOS.md)
