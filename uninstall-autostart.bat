@echo off
rem 64 OS: undoes install-autostart.bat. Removes the start at login and the Desktop shortcut, and stops the server.
rem Your data in the data folder is not touched.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup\uninstall-startup.ps1"
pause
