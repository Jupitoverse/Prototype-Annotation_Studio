@echo off
title Annotation Studio V1 - Public URL (cloudflared)
cd /d "%~dp0"

echo Annotation Studio V1 - Create public URL via Cloudflare Tunnel
echo.

where cloudflared >nul 2>nul
if errorlevel 1 (
  echo cloudflared not found. Attempting to install via winget...
  winget install cloudflare.cloudflared --accept-package-agreements --accept-source-agreements 2>nul
  if errorlevel 1 (
    echo Winget install failed or winget not available.
    echo Install manually: https://github.com/cloudflare/cloudflared/releases
    echo Or run: winget install cloudflare.cloudflared
    pause
    exit /b 1
  )
  echo Install completed. Please close and run this script again, or open a new terminal.
  pause
  exit /b 0
)

echo For a shareable public URL, use the BACKEND ^(port 8000^) with built frontend:
echo   1. In "frontend" folder run: npm run build
echo   2. Start backend: cd backend ^& uvicorn app.main:app --host 127.0.0.1 --port 8000
echo   3. This script will tunnel that URL. ^(If you use startserver.bat, only backend is shared; open the URL from the tunnel.^)
echo.
echo Creating public tunnel to http://127.0.0.1:8000 ...
echo Share the URL shown below. It will work until you close this window.
echo.

cloudflared tunnel --url http://127.0.0.1:8000

pause
