@echo off
title ExamSeat Pro - Frontend Dev Server
color 0B

echo.
echo  =====================================================
echo   ExamSeat Pro - Vite Frontend Dev Server
echo  =====================================================
echo.
echo  [INFO] Starting Vite on port 3000...
echo  [INFO] API calls proxied to http://localhost:8080
echo.
echo  IMPORTANT: Start the backend first (START_BACKEND.bat)
echo  Open browser at: http://localhost:3000
echo.

cd /d "%~dp0"
npm run dev

pause

