param([switch]$Aplicar, [switch]$Verificar)
$ErrorActionPreference = 'Stop'

# Tarefa unica, por usuario, sem senha ou segredo no Agendador do Windows.
$taskName = 'SirFisher-RevisaoQR-20261117'
$taskWorkspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$taskScript = Join-Path $PSScriptRoot 'perfil_qr.py'
$taskOutput = Join-Path $taskWorkspace 'gestao/tmp/perfil-qr-2026-11-17/perfil-qr.json'
$taskDate = [DateTimeOffset]::Parse('2026-11-17T09:00:00-03:00').LocalDateTime
$taskPython = (& python -c 'import sys; print(sys.executable)').Trim()
if ($LASTEXITCODE -ne 0) { throw 'Python indisponivel.' }
$taskPythonWindowless = Join-Path ([IO.Path]::GetDirectoryName($taskPython)) 'pythonw.exe'
if (-not (Test-Path -LiteralPath $taskPythonWindowless -PathType Leaf)) {
    throw 'pythonw.exe ausente; nenhuma tarefa criada.'
}
if (-not (Test-Path -LiteralPath $taskScript -PathType Leaf)) { throw 'Relatorio ausente.' }
$taskArguments = '-X utf8 "' + $taskScript + '" relatorio --start 2026-11-03 --end 2026-11-16 --out "' + $taskOutput + '"'
$taskExisting = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($taskExisting) {
    if ($taskExisting.Actions.Count -ne 1 -or
        $taskExisting.Actions[0].Execute -ne $taskPythonWindowless -or
        $taskExisting.Actions[0].Arguments -ne $taskArguments -or
        ([datetime]$taskExisting.Triggers[0].StartBoundary) -ne $taskDate) {
        throw 'Tarefa existente divergente; preservada sem alteracao.'
    }
}
if ($Aplicar -and -not $taskExisting) {
    $taskAction = New-ScheduledTaskAction -Execute $taskPythonWindowless -Argument $taskArguments -WorkingDirectory $taskWorkspace
    $taskTrigger = New-ScheduledTaskTrigger -Once -At $taskDate
    $taskPrincipal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value) -LogonType Interactive -RunLevel Limited
    $taskSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
    $taskDefinition = New-ScheduledTask -Action $taskAction -Trigger $taskTrigger -Principal $taskPrincipal -Settings $taskSettings -Description 'Consulta agregada QR no GA4; sem campanha, envio de mensagens ou alteracao de dados.'
    Register-ScheduledTask -TaskName $taskName -InputObject $taskDefinition | Out-Null
    $taskExisting = Get-ScheduledTask -TaskName $taskName
}
if ($Verificar -and -not $taskExisting) { throw 'Tarefa ainda nao registrada.' }
[pscustomobject]@{
    State = $(if ($taskExisting) { 'registrada' } else { 'previa' })
    Name = $taskName
    StartFortaleza = '2026-11-17 09:00 -03:00'
    StartWhenAvailable = $(if ($taskExisting) { $taskExisting.Settings.StartWhenAvailable } else { $true })
    InteractiveSessionRequired = $true
    Report = $taskOutput
} | ConvertTo-Json
