@echo off
title Classify - API (Express)
cd /d "%~dp0"

if not exist "node_modules\" (
  echo Instalando dependencias del workspace...
  call pnpm install
)

if not exist "server\.env" (
  echo.
  echo [ERROR] Falta server\.env
  echo Copia server\.env.example a server\.env y completa SUPABASE_ANON_KEY.
  echo Dashboard: https://supabase.com/dashboard/project/jgrtmokyqdvdxsldmkou/settings/api
  echo.
  pause
  exit /b 1
)

echo Iniciando API en http://localhost:3001 ...
call pnpm run dev:server
pause
