@echo off
title Classify - Dev
cd /d "%~dp0"

if not exist "server\.env" (
  echo.
  echo [ERROR] Falta server\.env — copia server\.env.example y completa SUPABASE_ANON_KEY.
  echo.
  pause
  exit /b 1
)

echo Abriendo API y Vite en ventanas separadas...
start "Classify API" cmd /k "%~dp0start-api.bat"
timeout /t 2 /nobreak >nul
start "Classify Vite" cmd /k "%~dp0start-vite.bat"
echo Listo. Cerra esta ventana si queres.
