param(
    [switch]$PreflightOnly,
    [switch]$NoBrowser,
    [ValidateRange(0, 3600)][int]$RunSeconds = 0,
    [ValidateRange(1024, 65535)][int]$ExpressPort = 3000,
    [ValidateRange(1024, 65535)][int]$VitePort = 3001,
    [ValidateRange(1024, 65535)][int]$MyObPort = 8001
)

$ErrorActionPreference = 'Stop'
$MeroRoot = Split-Path -Parent $PSScriptRoot
$ServerRoot = Join-Path $MeroRoot 'server'
$MyObRoot = if ($env:MYOB_BACKEND_DIR) { [IO.Path]::GetFullPath($env:MYOB_BACKEND_DIR) } else { [IO.Path]::GetFullPath((Join-Path $MeroRoot '..\MyOb\backend')) }
$Children = [Collections.Generic.List[Diagnostics.Process]]::new()

function Import-DotEnv([string]$Path) {
    if (-not (Test-Path $Path -PathType Leaf)) { return }
    foreach ($line in Get-Content $Path) {
        if ($line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') { continue }
        $name = $Matches[1]
        if ([Environment]::GetEnvironmentVariable($name, 'Process')) { continue }
        $value = $Matches[2].Trim()
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) { $value = $value.Substring(1, $value.Length - 2) }
        [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
}

function Assert-PortFree([int]$Port) {
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Any, $Port)
    $listener.ExclusiveAddressUse = $true
    try { $listener.Start() } catch { throw "Port $Port is already in use." } finally { $listener.Stop() }
}

function Wait-Ready([string]$Name, [string]$Url, [int]$Seconds = 45) {
    $deadline = [DateTime]::UtcNow.AddSeconds($Seconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        foreach ($child in $Children) { if ($child.HasExited) { throw "$Name could not start because process $($child.Id) exited." } }
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) { Write-Host "  READY $Name"; return }
        } catch { Start-Sleep -Milliseconds 400 }
    }
    throw "$Name did not become ready within $Seconds seconds."
}

function Stop-Children {
    foreach ($child in $Children) {
        if (-not $child.HasExited) {
            Stop-Process -Id $child.Id -ErrorAction SilentlyContinue
            try { $child.WaitForExit(5000) | Out-Null } catch {}
            if (-not $child.HasExited) { Stop-Process -Id $child.Id -Force -ErrorAction SilentlyContinue }
        }
    }
}

try {
    Write-Host 'Mero + MyOb preflight'
    if (-not (Test-Path $ServerRoot -PathType Container)) { throw "Mero server directory is missing." }
    if (-not (Test-Path $MyObRoot -PathType Container)) { throw "MyOb backend directory is missing. Set MYOB_BACKEND_DIR to its backend folder." }
    Import-DotEnv (Join-Path $ServerRoot '.env')

    $nodeVersion = (& node --version).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $nodeVersion.StartsWith('v22.')) { throw "Node 22 is required; found '$nodeVersion'." }
    Write-Host "  OK Node 22 ($nodeVersion)"
    $Python = Join-Path $MyObRoot 'venv\Scripts\python.exe'
    if (-not (Test-Path $Python -PathType Leaf)) { throw "Python virtual environment is missing at MyOb/backend/venv." }
    $pythonVersion = (& $Python -c 'import platform; print(platform.python_version())').Trim()
    if ($LASTEXITCODE -ne 0 -or -not $pythonVersion.StartsWith('3.12.')) { throw "Python 3.12 is required; found '$pythonVersion'." }
    Write-Host "  OK Python 3.12 ($pythonVersion)"

    foreach ($directory in @((Join-Path $MeroRoot 'node_modules'), (Join-Path $ServerRoot 'node_modules'))) {
        if (-not (Test-Path $directory -PathType Container)) { throw "Dependencies are missing at '$directory'. Run npm ci in that project." }
    }
    & $Python -c 'import fastapi, uvicorn, sqlalchemy, fastembed' 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'MyOb Python dependencies are missing. Install backend/requirements.txt into its venv.' }

    foreach ($name in @('JWT_SIGNING_KEY', 'API_KEY_ENCRYPTION_KEY')) {
        $value = [Environment]::GetEnvironmentVariable($name, 'Process')
        if (-not $value -or $value.Length -lt 32) { throw "$name must be configured with at least 32 characters in server/.env or the process environment." }
    }
    foreach ($port in @($ExpressPort, $VitePort, $MyObPort, 1455)) { Assert-PortFree $port }

    if ($PreflightOnly) { Write-Host 'PREFLIGHT_OK'; exit 0 }

    $bytes = [byte[]]::new(48)
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $random.GetBytes($bytes) } finally { $random.Dispose() }
    $serviceToken = [Convert]::ToBase64String($bytes)
    $env:MYOB_SERVICE_TOKEN = $serviceToken
    $env:MERO_SERVICE_TOKEN = $serviceToken
    $env:MYOB_BASE_URL = "http://127.0.0.1:$MyObPort"
    $env:MYOB_HOST = '127.0.0.1'
    $env:MYOB_PORT = "$MyObPort"
    $env:PORT = "$ExpressPort"
    $env:CORS_ORIGIN = "http://127.0.0.1:$VitePort"
    $env:VITE_API_URL = "http://127.0.0.1:$ExpressPort/api"

    $node = (Get-Command node).Source
    $Children.Add((Start-Process -FilePath $Python -ArgumentList 'runner.py' -WorkingDirectory $MyObRoot -PassThru -NoNewWindow))
    $Children.Add((Start-Process -FilePath $node -ArgumentList 'index.js' -WorkingDirectory $ServerRoot -PassThru -NoNewWindow))
    $Children.Add((Start-Process -FilePath $node -ArgumentList 'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',"$VitePort",'--strictPort' -WorkingDirectory $MeroRoot -PassThru -NoNewWindow))

    Wait-Ready 'MyOb' "http://127.0.0.1:$MyObPort/health"
    Wait-Ready 'Express' "http://127.0.0.1:$ExpressPort/health"
    Wait-Ready 'Mero' "http://127.0.0.1:$VitePort/"
    if (-not $NoBrowser) { Start-Process "http://127.0.0.1:$VitePort/" }
    Write-Host 'Mero + MyOb are running. Press Ctrl+C to stop all three.'
    if ($RunSeconds -gt 0) { Start-Sleep -Seconds $RunSeconds; exit 0 }

    while ($true) {
        foreach ($child in $Children) { if ($child.HasExited) { throw "Process $($child.Id) exited unexpectedly." } }
        Start-Sleep -Seconds 1
    }
} finally {
    Stop-Children
    Remove-Item Env:MYOB_SERVICE_TOKEN -ErrorAction SilentlyContinue
    Remove-Item Env:MERO_SERVICE_TOKEN -ErrorAction SilentlyContinue
}
