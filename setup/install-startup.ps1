# 64 OS: start the local server at every login, put a "64 OS" shortcut on the Desktop, then start it now and open it.
# Run once (again after moving the OS folder or reinstalling Node):
#   install-autostart.bat (or: powershell -ExecutionPolicy Bypass -File setup\install-startup.ps1)
# Undo: uninstall-autostart.bat
# -NoOpen: do everything but open the page.
param([switch]$NoOpen)
$ErrorActionPreference = "Stop"
$setup = Split-Path -Parent $MyInvocation.MyCommand.Path
$os = Split-Path -Parent $setup
$server = Join-Path $os "server.mjs"
$node = (Get-Command node -ErrorAction Stop).Source
$taskName = "64 OS server"
$url = "http://127.0.0.1:6464/"

# run-hidden.vbs starts node with no window and starts it again (up to 5 times, a minute apart) if it stops with an
# error. It is written here, not kept in git, because it holds this PC's paths.
$vbs = Join-Path $setup "run-hidden.vbs"
$vbsText = @"
' Starts the 64 OS server (server.mjs) with no window. Written by install-startup.ps1 for this PC.
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "$os"
For i = 1 To 5
  code = sh.Run("""$node"" ""$server""", 0, True)
  If code = 0 Then Exit For
  WScript.Sleep 60000
Next
"@
Set-Content -Path $vbs -Value $vbsText -Encoding Unicode

# 1. at logon: a Task Scheduler task for this user (no admin needed); the Startup folder if that is refused
$how = ""
try {
  $user = "$env:USERDOMAIN\$env:USERNAME"
  $action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbs`"" -WorkingDirectory $os
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
  $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
  $how = "Task Scheduler task '$taskName', at every logon"
} catch {
  $startup = [Environment]::GetFolderPath("Startup")
  $lnk = Join-Path $startup "64 OS server.lnk"
  $ws = New-Object -ComObject WScript.Shell
  $sc = $ws.CreateShortcut($lnk)
  $sc.TargetPath = "wscript.exe"
  $sc.Arguments = "`"$vbs`""
  $sc.WorkingDirectory = $os
  $sc.Save()
  $how = "a shortcut in the Startup folder ($lnk), because the scheduled task was refused: $($_.Exception.Message)"
}

# 2. the Desktop shortcut opens the served app (127.0.0.1, not localhost: the server listens on IPv4 only)
$desktop = [Environment]::GetFolderPath("Desktop")
$urlFile = Join-Path $desktop "64 OS.url"
Set-Content -Path $urlFile -Value "[InternetShortcut]`r`nURL=$url`r`n" -Encoding ASCII

# 3. start it now (a second copy stops by itself when the port is taken) and open the page once it answers
$up = $false
try { Invoke-WebRequest -Uri ($url + "api/state") -UseBasicParsing -TimeoutSec 2 | Out-Null; $up = $true } catch {}
if (-not $up) {
  Start-Process -FilePath "wscript.exe" -ArgumentList "`"$vbs`"" -WorkingDirectory $os
  for ($i = 0; $i -lt 20 -and -not $up; $i++) {
    Start-Sleep -Milliseconds 500
    try { Invoke-WebRequest -Uri ($url + "api/state") -UseBasicParsing -TimeoutSec 2 | Out-Null; $up = $true } catch {}
  }
}
Write-Output "Start at logon: $how"
Write-Output "Desktop shortcut: $urlFile"
if ($up) {
  Write-Output "Server: running at $url (node: $node)"
  if (-not $NoOpen) { Start-Process $url }
} else {
  Write-Output "Server: did not answer within 10 s. See $os\data\server.log"
  exit 1
}
