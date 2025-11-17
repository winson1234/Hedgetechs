# Check if Brokerage Server is Running
Write-Host "Checking server status..." -ForegroundColor Cyan
Write-Host ""

# Check for server process
$serverProcess = Get-Process | Where-Object { $_.ProcessName -eq "server" -or $_.Path -like "*server.exe" }

if ($serverProcess) {
    Write-Host "✓ Server process found (PID: $($serverProcess.Id))" -ForegroundColor Green
} else {
    Write-Host "✗ No server process found" -ForegroundColor Red
}

# Check if port 8080 is listening
$portCheck = netstat -ano | findstr ":8080" | findstr "LISTENING"
if ($portCheck) {
    Write-Host "✓ Port 8080 is listening" -ForegroundColor Green
} else {
    Write-Host "✗ Port 8080 is not listening" -ForegroundColor Red
}

# Try to make a request
Write-Host ""
Write-Host "Testing server endpoint..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/api/v1/exchange-rate?symbols=BTC" -Method GET -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✓ Server is responding! (Status: $($response.StatusCode))" -ForegroundColor Green
    Write-Host "  Response: $($response.Content.Substring(0, [Math]::Min(50, $response.Content.Length)))..." -ForegroundColor Gray
} catch {
    Write-Host "✗ Server is not responding" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "To start the server, run: .\start-server.bat" -ForegroundColor Yellow


