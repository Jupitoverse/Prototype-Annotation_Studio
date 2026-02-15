@echo off
title Annotation Studio V1 - Servers
cd /d "%~dp0"

echo Starting Backend (FastAPI) on http://127.0.0.1:8000 ...
start "Annotation Studio - Backend" cmd /k "cd /d %~dp0backend && (if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat) && uvicorn app.main:app --reload"

timeout /t 3 /nobreak >nul

echo Starting Frontend (Vite) on http://localhost:5173 ...
start "Annotation Studio - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Backend: http://127.0.0.1:8000 (docs: http://127.0.0.1:8000/docs)
echo Frontend: http://localhost:5173
echo.
echo Login: abhi@annotationstudio.com / admin123
pause
