@echo off
setlocal
cd /d "%~dp0"

copy /Y "frontend\public\warehouse-logo.png" "installer\warehouse-logo.png" >nul
if errorlevel 1 (
  echo Failed to copy logo from frontend\public\warehouse-logo.png
  exit /b 1
)

set "CSC=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" (
  echo C# compiler not found: %CSC%
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "& \"%CSC%\" /nologo /target:exe /out:\"%~dp0installer\WarehouseBreezyInstaller.exe\" /reference:System.Drawing.dll /reference:Microsoft.CSharp.dll \"%~dp0installer\WarehouseBreezyInstaller.cs\""
if errorlevel 1 (
  echo Failed to build WarehouseBreezyInstaller.exe
  exit /b 1
)

echo Built installer: installer\WarehouseBreezyInstaller.exe
exit /b 0
