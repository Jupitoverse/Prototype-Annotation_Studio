@echo off
title Annotation Studio V1 - Servers
cd /d "%~dp0"

echo Annotation Studio V1 - Starting Backend and Frontend
echo.

echo [1/2] Starting Backend (FastAPI) on http://127.0.0.1:8000 ...
start "Annotation Studio - Backend" cmd /k "cd /d %~dp0backend && (if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat) && uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

timeout /t 3 /nobreak >nul

echo [2/2] Starting Frontend (Vite) on http://localhost:5173 ...
start "Annotation Studio - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Backend:  http://127.0.0.1:8000  (API docs: http://127.0.0.1:8000/docs)
echo Frontend: http://localhost:5173  (use this URL to open the app)
echo.
echo Demo login: abhi@annotationstudio.com / admin123
echo Reviewer:   reviewer@annotationstudio.com / demo
echo Annotator:  annotator@annotationstudio.com / demo
echo.
pause
