# Uninstall Brokerage Server Auto-Start
# This removes the server from Windows startup

Write-Host "Removing Brokerage Server from auto-start..." -ForegroundColor Yellow
Write-Host ""

# Remove from user startup folder
$startupFolder = [System.IO.Path]::Combine($env:APPDATA, "Microsoft", "Windows", "Start Menu", "Programs", "Startup")
$shortcutPath = Join-Path $startupFolder "Brokerage Server.lnk"

if (Test-Path $shortcutPath) {
    Remove-Item $shortcutPath -Force
    Write-Host "✓ Removed from user startup folder" -ForegroundColor Green
}

# Remove from Task Scheduler (if exists and running as admin)
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if ($isAdmin) {
    $taskName = "BrokerageServer"
    schtasks /Delete /TN $taskName /F 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Removed from Task Scheduler" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Auto-start removed successfully!" -ForegroundColor Green
Write-Host "The server will no longer start automatically." -ForegroundColor Yellow


