@echo off
setlocal
cd /d "%~dp0"

echo [Warehouse App] Starting services...
docker compose up -d
if errorlevel 1 (
  echo [Warehouse App] Failed to start containers.
  pause
  exit /b 1
)

echo [Warehouse App] Waiting for web app...
timeout /t 12 /nobreak >nul
set "URL=http://warehouse-breezy.local"

where msedge >nul 2>nul
if %errorlevel%==0 (
  start "" msedge --app="%URL%"
  exit /b 0
)

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="%URL%"
  exit /b 0
)

if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app="%URL%"
  exit /b 0
)

start "" "%URL%"
exit /b 0
