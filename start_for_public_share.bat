@echo off
title Annotation Studio V1 - Prepare for public URL
cd /d "%~dp0"

echo [1/2] Building frontend for production...
cd frontend
call npm run build
cd ..
if errorlevel 1 (
  echo Frontend build failed.
  pause
  exit /b 1
)

echo [2/2] Starting backend on http://127.0.0.1:8000 ...
echo Backend will serve the built app. Keep this window open.
echo In ANOTHER window run: start_public_url.bat to get the public share URL.
echo.
start "Annotation Studio - Backend (for public share)" cmd /k "cd /d %~dp0backend && (if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat) && uvicorn app.main:app --host 127.0.0.1 --port 8000"

timeout /t 2 /nobreak >nul
echo.
echo Backend starting. Now run start_public_url.bat to create the public URL.
pause
