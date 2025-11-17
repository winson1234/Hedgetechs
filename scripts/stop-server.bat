@echo off
REM Stop Brokerage Server
REM This batch file stops the running server process

echo Stopping Brokerage Server...
echo.

REM Find and kill server.exe processes
taskkill /F /IM server.exe 2>nul
if errorlevel 1 (
    echo No server.exe process found.
) else (
    echo Server stopped successfully!
)

REM Also try to kill PowerShell windows with server in title
for /f "tokens=2" %%a in ('tasklist /FI "WINDOWTITLE eq *BROKERAGE SERVER*" /FO LIST ^| findstr "PID"') do (
    taskkill /F /PID %%a 2>nul
)

REM Kill any hidden PowerShell processes that might be running the server
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq powershell.exe" /FO CSV ^| findstr /V "WindowTitle"') do (
    taskkill /F /PID %%a 2>nul
)

echo.
echo Done!
pause

