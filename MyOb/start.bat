@echo off
title MyOb - AI Note-Taking App
echo ========================================
echo   Starting MyOb Application
echo ========================================
echo.

:: Start Backend Server
echo [1/3] Starting Backend Server (port 8000)...
cd /d "%~dp0backend"
start "MyOb Backend" cmd /k "venv\Scripts\python.exe runner.py"

:: Wait for backend to initialize
echo [2/3] Waiting for backend to initialize...
timeout /t 5 /nobreak > nul

:: Start Frontend Server
echo [3/3] Starting Frontend Server (port 8081)...
cd /d "%~dp0My_Obsidian_FrontEnd-main"
start "MyOb Frontend" cmd /k "npm run dev"

:: Wait for frontend to initialize
timeout /t 5 /nobreak > nul

:: Open browser
echo.
echo ========================================
echo   Opening browser...
echo ========================================
start http://localhost:8081

echo.
echo ========================================
echo   MyOb is running!
echo ----------------------------------------
echo   Frontend: http://localhost:8081
echo   Backend:  http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo ----------------------------------------
echo   Close the server windows to stop.
echo ========================================
