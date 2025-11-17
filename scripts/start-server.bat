@echo off
REM Start Brokerage Server in Background
REM This batch file runs the Go server in a minimized window

echo Starting Brokerage Server...
echo.

cd ..\cmd\server

REM Check if server.exe exists, if not, build it
if not exist server.exe (
    echo Building server...
    go build -o server.exe
    if errorlevel 1 (
        echo Build failed! Please check for errors.
        pause
        exit /b 1
    )
)

REM Start server in minimized window
start "Brokerage Server" /MIN powershell -NoExit -Command "Write-Host '=== BROKERAGE SERVER ===' -ForegroundColor Green; Write-Host 'Server is running on http://localhost:8080' -ForegroundColor Cyan; Write-Host 'Press Ctrl+C to stop the server' -ForegroundColor Yellow; Write-Host ''; .\server.exe"

echo.
echo Server started successfully!
echo The server is running in a minimized window.
echo You can now close this window - the server will keep running.
echo.
echo To stop the server, look for the minimized window titled "Brokerage Server"
echo.
pause


