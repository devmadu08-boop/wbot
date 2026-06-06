param(
  [string]$TaskName = "Madu AI WhatsApp Assistant",
  [string]$ProjectPath = (Resolve-Path ".").Path
)

$pm2 = (Get-Command pm2.cmd -ErrorAction Stop).Source
$action = New-ScheduledTaskAction -Execute $pm2 -Argument "resurrect" -WorkingDirectory $ProjectPath
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "Administrator" -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Force | Out-Null

Write-Host "Created startup task: $TaskName"
Write-Host "PM2 will run 'pm2 resurrect' when Windows starts."
