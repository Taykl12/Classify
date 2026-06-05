# Proyecto Classify

Aplicación **React + TypeScript + Vite** (CSS vanilla) con API **Express** y **Supabase** (proyecto Classify `jgrtmokyqdvdxsldmkou`).

## Desarrollo local

1. Copiá `server/.env.example` a `server/.env` y completá `SUPABASE_ANON_KEY` (Dashboard → Settings → API).
2. En una terminal: `npm run dev:server` (API en `http://localhost:3001`).
3. En otra: `npm install` y `npm run dev` (front en `http://localhost:5173`).

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
npm run build
npm run build:server
``` 



[Ver cambios](CAMBIOS.md)
