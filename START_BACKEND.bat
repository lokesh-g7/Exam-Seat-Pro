@echo off
title ExamSeat Pro - Backend Server
color 0A

echo.
echo  =====================================================
echo   ExamSeat Pro - Spring Boot Backend Startup
echo  =====================================================
echo.
echo  [INFO] Starting Spring Boot on port 8080...
echo  [INFO] Database: H2 File (examseat.db.mv.db)
echo  [INFO] DDL Auto: update (all tables auto-created)
echo.

cd /d "%~dp0backend"
call mvnw.cmd spring-boot:run -o

pause

