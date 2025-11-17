# Start Brokerage Server Completely in Background (No Window)
# This runs the server with NO visible window - completely hidden

Write-Host "Starting Brokerage Server in background (no window)..." -ForegroundColor Green
Write-Host ""

# Change to server directory
$serverPath = Join-Path (Split-Path $PSScriptRoot -Parent) "cmd\server"
$serverExe = Join-Path $serverPath "server.exe"

# Check if server.exe exists, if not, build it
if (-not (Test-Path $serverExe)) {
    Write-Host "Building server..." -ForegroundColor Cyan
    Set-Location $serverPath
    go build -o server.exe
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed! Please check for errors." -ForegroundColor Red
        exit 1
    }
    Set-Location (Split-Path $PSScriptRoot -Parent)
}

# Check if server is already running
$existingProcess = Get-Process | Where-Object { $_.Path -eq (Resolve-Path $serverExe).Path }
if ($existingProcess) {
    Write-Host "Server is already running (PID: $($existingProcess.Id))" -ForegroundColor Yellow
    Write-Host "To stop it, run: .\scripts\stop-server.bat" -ForegroundColor Yellow
    exit 0
}

# Start server completely hidden (no window at all)
$processInfo = New-Object System.Diagnostics.ProcessStartInfo
$processInfo.FileName = $serverExe
$processInfo.WorkingDirectory = $serverPath
$processInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
$processInfo.CreateNoWindow = $true
$processInfo.UseShellExecute = $false
$processInfo.RedirectStandardOutput = $true
$processInfo.RedirectStandardError = $true

$process = New-Object System.Diagnostics.Process
$process.StartInfo = $processInfo

# Optional: Log output to file
$logFile = Join-Path $serverPath "server.log"
$process.StartInfo.RedirectStandardOutput = $true
$process.StartInfo.RedirectStandardError = $true

try {
    $process.Start() | Out-Null
    Write-Host "✓ Server started successfully in background!" -ForegroundColor Green
    Write-Host "  Process ID: $($process.Id)" -ForegroundColor Cyan
    Write-Host "  Log file: $logFile" -ForegroundColor Gray
    Write-Host ""
    Write-Host "You can now close this window - the server will keep running!" -ForegroundColor Green
    Write-Host "To stop the server, run: .\scripts\stop-server.bat" -ForegroundColor Yellow
} catch {
    Write-Host "Failed to start server: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}


