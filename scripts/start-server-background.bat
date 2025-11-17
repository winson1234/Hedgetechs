@echo off
REM Start Brokerage Server Completely in Background (No Window)
REM This runs the server with NO visible window

echo Starting Brokerage Server in background (no window)...
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

REM Check if server is already running
tasklist /FI "IMAGENAME eq server.exe" 2>nul | find /I "server.exe" >nul
if %errorlevel% == 0 (
    echo Server is already running!
    echo To stop it, run: scripts\stop-server.bat
    pause
    exit /b 0
)

REM Start server completely hidden using PowerShell
powershell -WindowStyle Hidden -Command "Start-Process -FilePath '.\server.exe' -WorkingDirectory '%CD%' -WindowStyle Hidden -NoNewWindow"

echo.
echo Server started successfully in background!
echo You can now close this window - the server will keep running!
echo.
echo To stop the server, run: scripts\stop-server.bat
echo.
pause


