@echo off
title Annotation Studio V1 - First time setup
cd /d "%~dp0"

echo Annotation Studio V1 - First time setup
echo.

echo [1/3] Backend: creating venv and installing Python dependencies...
cd backend
if not exist "venv" (
  python -m venv venv 2>nul
  if errorlevel 1 (
    echo Trying py -m venv venv...
    py -m venv venv 2>nul
  )
)
if exist "venv\Scripts\activate.bat" (
  call venv\Scripts\activate.bat
) else (
  echo No venv found; using system Python.
)
pip install -r requirements.txt
if errorlevel 1 (
  echo pip install failed. Try: pip install -r requirements.txt
)
cd ..

echo [2/3] Frontend: installing Node dependencies...
cd frontend
call npm install
if errorlevel 1 (
  echo npm install failed. Try: npm install
)
cd ..

echo [3/3] Done.
echo.
echo Next: Run startserver.bat to start backend and frontend.
echo Then open http://localhost:5173 in your browser.
pause
