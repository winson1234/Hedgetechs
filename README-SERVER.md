# Server Management Guide

## 🚀 Auto-Start on Windows (Recommended!)

### Install Auto-Start (Server starts automatically when Windows boots)
Double-click `scripts\install-auto-start.bat` or run:
```powershell
.\scripts\install-auto-start.ps1
```

**This will:**
- ✅ Start the server automatically when you log in to Windows
- ✅ Run completely hidden in the background
- ✅ No need to manually start the server ever again!
- ✅ Your website will always have the server running

**To remove auto-start:**
Double-click `scripts\uninstall-auto-start.bat`

---

## Quick Start

### Start Server (Background - NO WINDOW) ⭐ RECOMMENDED
Double-click `scripts\start-server-background.bat` or run:
```powershell
.\scripts\start-server-background.ps1
```

The server will run **completely hidden** with NO visible window. You can close ALL windows and it keeps running!

### Start Server (Minimized Window)
Double-click `scripts\start-server.bat` or run:
```powershell
.\scripts\start-server.ps1
```

The server will run in a minimized window and continue running even if you close the terminal.

### Stop Server
Double-click `scripts\stop-server.bat` or run:
```powershell
.\scripts\stop-server.ps1
```

## Running the Server

### Option 1: Background Script - NO WINDOW (Best for closing PowerShell) ⭐
- **Windows**: Double-click `scripts\start-server-background.bat`
- The server runs **completely hidden** - no window at all
- You can close ALL PowerShell windows - server keeps running
- Perfect if you want to close PowerShell completely
- To stop: Double-click `scripts\stop-server.bat`

### Option 2: Background Script - Minimized Window
- **Windows**: Double-click `scripts\start-server.bat`
- The server runs in a minimized window
- You can close the terminal - server keeps running
- To stop: Double-click `scripts\stop-server.bat` or find the minimized window

### Option 3: Manual Start
```bash
cd cmd/server
go run main.go
```
⚠️ **Note**: Server will stop if you close the terminal window.

### Option 4: Build and Run Executable
```bash
cd cmd/server
go build -o server.exe
.\server.exe
```

## Server Status

The server runs on:
- **HTTP**: http://localhost:8080
- **HTTPS**: https://localhost:8080 (if certificates are present)

## Troubleshooting

### Server won't start
1. Make sure Go is installed: `go version`
2. Check if port 8080 is available: `netstat -ano | findstr :8080`
3. Check the minimized window for error messages

### Server stops unexpectedly
1. Check the minimized PowerShell window for errors
2. Verify `.env` file exists in project root
3. Check server logs in the minimized window

### Can't find the server window
1. Check taskbar for minimized PowerShell windows
2. Look for window titled "Brokerage Server"
3. Use Task Manager to find `server.exe` or `powershell.exe` processes

## Background Process Management

### View Running Server
```powershell
Get-Process | Where-Object {$_.ProcessName -eq "server" -or $_.Path -like "*server.exe"}
```

### Kill Server Process
```powershell
Stop-Process -Name "server" -Force
```

### Check if Server is Running
```powershell
Invoke-WebRequest -Uri "http://localhost:8080/api/v1/exchange-rate?symbols=BTC" -Method GET
```

If you get a response, the server is running!

