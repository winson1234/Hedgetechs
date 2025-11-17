# Start Brokerage Server in Background
# This script runs the Go server in the background so it continues even if you close the terminal

Write-Host "Starting Brokerage Server in background..." -ForegroundColor Green
Write-Host "Server will continue running even if you close this window." -ForegroundColor Yellow
Write-Host ""

# Change to server directory
$serverPath = Join-Path (Split-Path $PSScriptRoot -Parent) "cmd\server"

# Check if server.exe exists, if not, build it
if (-not (Test-Path (Join-Path $serverPath "server.exe"))) {
    Write-Host "Building server..." -ForegroundColor Cyan
    Set-Location $serverPath
    go build -o server.exe
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed! Please check for errors." -ForegroundColor Red
        exit 1
    }
    Set-Location (Split-Path $PSScriptRoot -Parent)
}

# Start the server in a new minimized window
$serverExe = Join-Path $serverPath "server.exe"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$serverPath'; Write-Host '=== BROKERAGE SERVER ===' -ForegroundColor Green; Write-Host 'Server is running on http://localhost:8080' -ForegroundColor Cyan; Write-Host 'Press Ctrl+C to stop the server' -ForegroundColor Yellow; Write-Host ''; .\server.exe" -WindowStyle Minimized

Write-Host "Server started successfully!" -ForegroundColor Green
Write-Host "The server is running in a minimized window." -ForegroundColor Cyan
Write-Host "To stop the server, look for the minimized PowerShell window and press Ctrl+C" -ForegroundColor Yellow
Write-Host ""
Write-Host "You can now close this window - the server will keep running." -ForegroundColor Green


