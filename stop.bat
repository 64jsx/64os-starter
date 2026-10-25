@echo off
rem 64 OS: stops the local server of this folder (started by start.bat or at login). Your data stays in the data folder.
rem With the start at login installed, the server comes back at the next login; uninstall-autostart.bat turns that off.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s=Join-Path '%~dp0' 'server.mjs'; $n=0;" ^
  "Get-CimInstance Win32_Process -Filter \"Name='wscript.exe'\" | Where-Object { $_.CommandLine -like '*run-hidden.vbs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force };" ^
  "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like ('*'+$s+'*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; $n++ };" ^
  "if($n){Write-Host '64 OS stopped.'}else{Write-Host '64 OS was not running.'}"
pause
