@echo off
title Classify - API (Express)
cd /d "%~dp0"

if not exist "node_modules\" (
  echo Instalando dependencias del frontend...
  call npm install
)

if not exist "server\node_modules\" (
  echo Instalando dependencias del servidor...
  call npm install --prefix server
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
call npm run dev:server
pause
