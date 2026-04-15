@echo off
setlocal
cd /d "%~dp0"

:: Require admin rights for hosts update.
net session >nul 2>nul
if %errorlevel% neq 0 (
  echo [Warehouse Breezy Installer] Requesting administrator permissions...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo [Warehouse Breezy Installer] Running installer...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install_warehouse_breezy.ps1" -ProjectRoot "%~dp0"

if errorlevel 1 (
  echo [Warehouse Breezy Installer] Installation failed.
  pause
  exit /b 1
)

echo [Warehouse Breezy Installer] Done.
echo Shortcut "Warehouse Breezy" is ready on Desktop.
pause
