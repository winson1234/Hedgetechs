# Install Brokerage Server to Start Automatically on Windows Startup
# This will add the server to Windows startup so it runs automatically

Write-Host "Installing Brokerage Server to start automatically..." -ForegroundColor Green
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "This script needs Administrator privileges." -ForegroundColor Yellow
    Write-Host "Right-click and select 'Run as Administrator'" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternatively, we can add it to your user startup folder (no admin needed)..." -ForegroundColor Cyan
    Write-Host ""
    
    # Add to user startup folder (no admin needed)
    $startupFolder = [System.IO.Path]::Combine($env:APPDATA, "Microsoft", "Windows", "Start Menu", "Programs", "Startup")
    $shortcutPath = Join-Path $startupFolder "Brokerage Server.lnk"
    
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $startScriptPath = Join-Path $PSScriptRoot "start-server-background.bat"
    $shortcut.TargetPath = (Resolve-Path $startScriptPath).Path
    $shortcut.WorkingDirectory = (Split-Path $PSScriptRoot -Parent)
    $shortcut.Description = "Start Brokerage Server automatically"
    $shortcut.WindowStyle = 7  # Minimized
    $shortcut.Save()
    
    Write-Host "✓ Added to user startup folder!" -ForegroundColor Green
    Write-Host "  Location: $startupFolder" -ForegroundColor Gray
    Write-Host ""
    Write-Host "The server will now start automatically when you log in to Windows!" -ForegroundColor Green
    Write-Host ""
    Write-Host "To remove auto-start, delete the shortcut from:" -ForegroundColor Yellow
    Write-Host "  $shortcutPath" -ForegroundColor Gray
    exit 0
}

# Admin path: Add to Task Scheduler for system-wide startup
Write-Host "Adding to Windows Task Scheduler (system-wide)..." -ForegroundColor Cyan

$projectRoot = Split-Path $PSScriptRoot -Parent
$serverPath = Join-Path $projectRoot "cmd\server\server.exe"
$startScript = Join-Path $PSScriptRoot "start-server-background.bat"

# Create scheduled task
$taskName = "BrokerageServer"
$taskDescription = "Automatically start Brokerage Server on Windows startup"

# Remove existing task if it exists
schtasks /Delete /TN $taskName /F 2>$null

# Create new task
$action = New-ScheduledTaskAction -Execute $startScript -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description $taskDescription -Force | Out-Null

Write-Host "✓ Installed to Windows Task Scheduler!" -ForegroundColor Green
Write-Host ""
Write-Host "The server will now start automatically when Windows starts!" -ForegroundColor Green
Write-Host ""
Write-Host "To remove auto-start, run: .\scripts\uninstall-auto-start.ps1" -ForegroundColor Yellow


