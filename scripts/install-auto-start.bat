@echo off
REM Install Brokerage Server to Start Automatically on Windows Startup

echo Installing Brokerage Server to start automatically...
echo.

REM Add to user startup folder (no admin needed)
set "startupFolder=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "shortcutPath=%startupFolder%\Brokerage Server.lnk"

REM Create shortcut using PowerShell
powershell -Command "$shell = New-Object -ComObject WScript.Shell; $shortcut = $shell.CreateShortcut('%shortcutPath%'); $shortcut.TargetPath = '%CD%\start-server-background.bat'; $shortcut.WorkingDirectory = '%CD%'; $shortcut.Description = 'Start Brokerage Server automatically'; $shortcut.WindowStyle = 7; $shortcut.Save()"

if exist "%shortcutPath%" (
    echo.
    echo [OK] Added to user startup folder!
    echo.
    echo The server will now start automatically when you log in to Windows!
    echo.
    echo To remove auto-start, run: uninstall-auto-start.bat
) else (
    echo.
    echo [ERROR] Failed to create startup shortcut.
    echo Please run install-auto-start.ps1 as Administrator for more options.
)

echo.
pause


