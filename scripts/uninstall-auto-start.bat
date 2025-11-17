@echo off
REM Uninstall Brokerage Server Auto-Start

echo Removing Brokerage Server from auto-start...
echo.

REM Remove from user startup folder
set "startupFolder=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "shortcutPath=%startupFolder%\Brokerage Server.lnk"

if exist "%shortcutPath%" (
    del "%shortcutPath%"
    echo [OK] Removed from user startup folder
) else (
    echo No startup shortcut found.
)

REM Try to remove from Task Scheduler
schtasks /Delete /TN "BrokerageServer" /F 2>nul
if %errorlevel% == 0 (
    echo [OK] Removed from Task Scheduler
)

echo.
echo Auto-start removed successfully!
echo The server will no longer start automatically.
echo.
pause


