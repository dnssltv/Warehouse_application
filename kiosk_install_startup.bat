@echo off
setlocal
cd /d "%~dp0"

echo [Warehouse App Kiosk] Adding shortcut to Windows Startup...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root = (Get-Location).Path; $target = Join-Path $root 'kiosk_launch.bat'; $startup = [Environment]::GetFolderPath('Startup'); $lnkPath = Join-Path $startup 'Warehouse App Kiosk.lnk'; $w = New-Object -ComObject WScript.Shell; $s = $w.CreateShortcut($lnkPath); $s.TargetPath = $target; $s.WorkingDirectory = $root; $s.Save(); Write-Host ('Created: ' + $lnkPath)"

if errorlevel 1 (
  echo Failed to create shortcut.
  pause
  exit /b 1
)

echo.
echo After reboot, the kiosk will start automatically (Docker + fullscreen browser).
echo To remove: run kiosk_remove_startup.bat
pause
