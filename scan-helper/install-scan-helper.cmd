@echo off
rem Installs the TBC Scan Helper for the current Windows user (no admin rights needed).
rem Downloaded from the CRM, which fills in the address below.
setlocal
set "HELPER_DIR=%LOCALAPPDATA%\TBCScanHelper"
set "SCRIPT_URL=__SCRIPT_URL__"

echo Installing TBC Scan Helper...
if not exist "%HELPER_DIR%" mkdir "%HELPER_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri $env:SCRIPT_URL -OutFile (Join-Path $env:HELPER_DIR 'scan-helper.ps1')"
if errorlevel 1 (
  echo.
  echo Could not download the helper from the CRM. Check the internet connection and try again.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%HELPER_DIR%\scan-helper.ps1" -Install
echo.
pause
