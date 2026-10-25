@echo off
rem 64 OS: starts the server by itself every time you log in to Windows, puts a "64 OS" shortcut on the Desktop,
rem then starts it now and opens it. Run it once (again if you move this folder or reinstall Node.js).
rem Undo with uninstall-autostart.bat.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org and run this again.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup\install-startup.ps1"
pause
