# PowerShell script to reset rate limits for testing
# Usage: .\scripts\reset-rate-limits.ps1 <email>

param(
    [string]$Email = "*"
)

Write-Host "Resetting rate limits for: $Email" -ForegroundColor Yellow

# Load Redis connection details from .env
$envFile = ".env"
$redisPassword = "123456"  # Default
$redisAddr = "localhost:6379"  # Default

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^REDIS_PASSWORD=(.+)$') {
            $redisPassword = $matches[1]
        }
        if ($_ -match '^REDIS_ADDR=(.+)$') {
            $redisAddr = $matches[1]
        }
    }
}

# Split host and port
$parts = $redisAddr -split ":"
$redisHost = $parts[0]
$redisPort = if ($parts.Length -gt 1) { $parts[1] } else { "6379" }

Write-Host "Connecting to Redis at ${redisHost}:${redisPort}" -ForegroundColor Cyan

# Clear rate limit keys
$pattern = if ($Email -eq "*") { "ratelimit:*" } else { "ratelimit:*:$Email" }

Write-Host "Deleting keys matching: $pattern" -ForegroundColor Yellow

# Use Docker to run redis-cli commands
# Get all matching keys
$keysOutput = docker exec -i brokerage-redis redis-cli -a $redisPassword --scan --pattern $pattern 2>$null

if ($keysOutput) {
    $keys = $keysOutput -split "`n" | Where-Object { $_ -ne "" }

    # Delete each key
    foreach ($key in $keys) {
        docker exec -i brokerage-redis redis-cli -a $redisPassword DEL $key 2>$null | Out-Null
    }

    Write-Host "Deleted $($keys.Count) rate limit key(s)" -ForegroundColor Cyan
} else {
    Write-Host "No matching keys found" -ForegroundColor Yellow
}

Write-Host "`nRate limits reset successfully!" -ForegroundColor Green
Write-Host "You can now test forgot password again." -ForegroundColor Green
