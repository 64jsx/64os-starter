# 64 OS: undo install-startup.ps1. Removes the logon task (or the Startup shortcut), stops the running server and
# removes the Desktop shortcut. The data in the data folder is not touched.
#   uninstall-autostart.bat (or: powershell -ExecutionPolicy Bypass -File setup\uninstall-startup.ps1)
$ErrorActionPreference = "Continue"
$setup = Split-Path -Parent $MyInvocation.MyCommand.Path
$os = Split-Path -Parent $setup
$server = Join-Path $os "server.mjs"
$taskName = "64 OS server"

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
  Write-Output "Removed the task '$taskName'"
}
$lnk = Join-Path ([Environment]::GetFolderPath("Startup")) "64 OS server.lnk"
if (Test-Path $lnk) { Remove-Item $lnk; Write-Output "Removed $lnk" }

# stop only this server: wscript running run-hidden.vbs first (so it does not start node again), then node running server.mjs
Get-CimInstance Win32_Process -Filter "Name='wscript.exe'" | Where-Object { $_.CommandLine -like "*run-hidden.vbs*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Output "Stopped wscript $($_.ProcessId)" }
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like "*$server*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Output "Stopped node $($_.ProcessId)" }

$urlFile = Join-Path ([Environment]::GetFolderPath("Desktop")) "64 OS.url"
if (Test-Path $urlFile) { Remove-Item $urlFile; Write-Output "Removed $urlFile" }
$vbs = Join-Path $setup "run-hidden.vbs"
if (Test-Path $vbs) { Remove-Item $vbs }
