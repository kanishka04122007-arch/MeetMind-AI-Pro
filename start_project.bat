@echo off
echo ========================================================
echo          Starting MeetMind AI Project
echo ========================================================

echo [1/2] Starting FastAPI Backend on http://127.0.0.1:8000...
start "MeetMind Backend" cmd /k "cd /d %~dp0backend && .\venv\Scripts\uvicorn.exe main:app --host 127.0.0.1 --port 8000"

echo [2/2] Starting Vite Frontend on http://localhost:5173...
start "MeetMind Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================================
echo MeetMind AI is starting!
echo Frontend: http://localhost:5173
echo Backend API: http://127.0.0.1:8000/docs
echo ========================================================
pause
