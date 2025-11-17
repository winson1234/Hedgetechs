@echo off
REM Check if Brokerage Server is Running

echo Checking server status...
echo.

REM Check for server process
tasklist /FI "IMAGENAME eq server.exe" 2>nul | find /I "server.exe" >nul
if %errorlevel% == 0 (
    echo [OK] Server process found
) else (
    echo [ERROR] No server process found
)

REM Check if port 8080 is listening
netstat -ano | findstr ":8080" | findstr "LISTENING" >nul
if %errorlevel% == 0 (
    echo [OK] Port 8080 is listening
) else (
    echo [ERROR] Port 8080 is not listening
)

echo.
echo To start the server, run: start-server.bat
echo.
pause


