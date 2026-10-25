@echo off
rem 64 OS: starts the local server (if it is not running yet, with no window) and opens the app in your browser.
rem Double-click this file. Your data is saved in the data folder next to it. stop.bat stops the server.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org and double-click start.bat again.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$u='http://127.0.0.1:6464/'; $s=Join-Path '%~dp0' 'server.mjs';" ^
  "function up{try{Invoke-WebRequest -UseBasicParsing ($u+'api/state') -TimeoutSec 2|Out-Null;$true}catch{$false}};" ^
  "if(-not (up)){Start-Process -FilePath node -ArgumentList ('\"'+$s+'\"') -WorkingDirectory '%~dp0' -WindowStyle Hidden;" ^
  "for($i=0;$i -lt 20 -and -not (up);$i++){Start-Sleep -Milliseconds 500}};" ^
  "if(up){Start-Process $u}else{Write-Host 'The server did not start. See data\server.log'; exit 1}"
if errorlevel 1 pause
