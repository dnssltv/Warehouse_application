@echo off
setlocal
cd /d "%~dp0"

echo [Warehouse App Kiosk] Starting Docker Compose...
docker compose up -d --build
if errorlevel 1 (
  echo [Warehouse App Kiosk] Failed to start containers.
  pause
  exit /b 1
)

echo [Warehouse App Kiosk] Waiting for the web interface (about 25 seconds)...
timeout /t 25 /nobreak >nul

set "URL=http://localhost"

where msedge >nul 2>nul
if %errorlevel%==0 (
  start "" msedge --kiosk "%URL%" --edge-kiosk-type=fullscreen
  exit /b 0
)

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --kiosk "%URL%"
  exit /b 0
)

if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --kiosk "%URL%"
  exit /b 0
)

echo [Warehouse App Kiosk] Kiosk browser not found. Opening default browser...
start "" "%URL%"
exit /b 0
