@echo off
setlocal
cd /d "%~dp0"

echo [Warehouse App] Creating Desktop shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root = (Get-Location).Path; $target = Join-Path $root 'app_launch.bat'; $desktop = [Environment]::GetFolderPath('Desktop'); $lnk = Join-Path $desktop 'Warehouse App.lnk'; $w = New-Object -ComObject WScript.Shell; $s = $w.CreateShortcut($lnk); $s.TargetPath = $target; $s.WorkingDirectory = $root; $s.IconLocation = 'shell32.dll,220'; $s.Save(); Write-Host ('Created: ' + $lnk)"

if errorlevel 1 (
  echo Failed to create shortcut.
  pause
  exit /b 1
)

echo Shortcut created on Desktop: Warehouse App
pause
