@echo off
setlocal

echo [Warehouse App Kiosk] Removing shortcut from Startup...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$startup = [Environment]::GetFolderPath('Startup'); $lnkPath = Join-Path $startup 'Warehouse App Kiosk.lnk'; if (Test-Path $lnkPath) { Remove-Item $lnkPath -Force; Write-Host ('Removed: ' + $lnkPath) } else { Write-Host 'Shortcut was not found.' }"

pause
