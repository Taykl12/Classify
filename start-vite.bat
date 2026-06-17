@echo off
title Classify - Frontend (Vite)
cd /d "%~dp0"

if not exist "node_modules\" (
  echo Instalando dependencias del workspace...
  call pnpm install
)

echo Iniciando Vite en http://localhost:5173 ...
echo (El proxy /api apunta a http://localhost:3001 — inicia start-api.bat en otra ventana)
call pnpm run dev
pause
