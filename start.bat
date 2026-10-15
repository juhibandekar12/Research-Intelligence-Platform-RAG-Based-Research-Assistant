@echo off
title Launching Research Intelligence Platform...

echo ==========================================
echo   Starting Research Intelligence Platform
echo ==========================================

if not exist "backend\.env" (
    echo [ERROR] backend\.env file not found!
    echo Please copy backend\.env.example to backend\.env and configure your GEMINI_API_KEY.
    pause
    exit /b 1
)

echo [+] Starting FastAPI Backend (Port 8000)...
start "FastAPI Backend" cmd /k "cd /d e:\rag\backend && .venv\Scripts\activate.bat && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

timeout /t 3 /nobreak > nul

echo [+] Starting React Frontend (Port 5173)...
start "React Frontend" cmd /k "cd /d e:\rag\frontend && npm run dev"

timeout /t 2 /nobreak > nul

echo.
echo [OK] Platform launched!
echo      Backend:  http://localhost:8000
echo      Frontend: http://localhost:5173
echo      API Docs: http://localhost:8000/docs
echo.
echo Opening browser in 3 seconds...
timeout /t 3 /nobreak > nul
start http://localhost:5173
