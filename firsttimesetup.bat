@echo off
title Annotation Studio V1 - First time setup
cd /d "%~dp0"

echo [1/3] Backend: installing Python dependencies...
cd backend
if not exist "venv" (
  python -m venv venv 2>nul
  if errorlevel 1 (
    echo Try: py -m venv venv
    py -m venv venv 2>nul
  )
)
call venv\Scripts\activate.bat 2>nul
if not exist "venv\Scripts\activate.bat" (
  echo No venv; using system Python.
) else (
  call venv\Scripts\activate.bat
)
pip install -r requirements.txt
cd ..

echo [2/3] Frontend: installing Node dependencies...
cd frontend
call npm install
cd ..

echo [3/3] Done.
echo.
echo Run startserver.bat to start backend and frontend.
pause
