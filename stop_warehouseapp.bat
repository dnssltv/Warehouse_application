@echo off
setlocal
cd /d "%~dp0"

echo [Warehouse App] Stopping containers...
docker compose down
if errorlevel 1 (
  echo.
  echo [Warehouse App] Failed to stop containers.
  pause
  exit /b 1
)

echo.
echo [Warehouse App] Containers stopped.
pause
