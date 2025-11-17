# Stop Brokerage Server
# This script finds and stops the running server process

Write-Host "Stopping Brokerage Server..." -ForegroundColor Yellow
Write-Host ""

# Find server.exe processes by name
$serverProcesses = Get-Process -Name "server" -ErrorAction SilentlyContinue

# Also find by path
$serverPath = Join-Path (Split-Path $PSScriptRoot -Parent) "cmd\server\server.exe"
if (Test-Path $serverPath) {
    $serverExe = (Resolve-Path $serverPath).Path
    $processesByPath = Get-Process | Where-Object { $_.Path -eq $serverExe }
    $serverProcesses = $serverProcesses + $processesByPath | Sort-Object -Unique -Property Id
}

if ($serverProcesses.Count -eq 0) {
    Write-Host "No server process found. Server may not be running." -ForegroundColor Yellow
} else {
    foreach ($process in $serverProcesses) {
        Write-Host "Stopping process: $($process.ProcessName) (PID: $($process.Id))" -ForegroundColor Cyan
        try {
            Stop-Process -Id $process.Id -Force -ErrorAction Stop
        } catch {
            Write-Host "  Could not stop process $($process.Id): $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    Write-Host ""
    Write-Host "Server stopped successfully!" -ForegroundColor Green
}

# Also try to find PowerShell windows running the server
$psProcesses = Get-Process powershell -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowTitle -like "*BROKERAGE SERVER*" -or $_.MainWindowTitle -like "*server*"
}

if ($psProcesses.Count -gt 0) {
    Write-Host "Found PowerShell windows running the server. Closing them..." -ForegroundColor Cyan
    foreach ($ps in $psProcesses) {
        Stop-Process -Id $ps.Id -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green

