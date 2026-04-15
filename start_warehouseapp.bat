@echo off
setlocal
cd /d "%~dp0"

echo [Warehouse App] Starting containers...
docker compose up -d --build
if errorlevel 1 (
  echo.
  echo [Warehouse App] Failed to start containers.
  pause
  exit /b 1
)

for /f "tokens=14" %%i in ('ipconfig ^| findstr /R /C:"IPv4.*:"') do (
  set SERVER_IP=%%i
  goto :ip_found
)

:ip_found
if "%SERVER_IP%"=="" set SERVER_IP=localhost

echo.
echo [Warehouse App] Application is running.
echo Local URL:  http://localhost
echo LAN URL:    http://%SERVER_IP%
echo.
start http://localhost
pause
