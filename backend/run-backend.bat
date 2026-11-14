@echo off
echo ============================================
echo   ExamSeat Pro - Backend Startup Script
echo ============================================
echo.

REM Try to find Java automatically
where java >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo Found Java in PATH. Starting backend...
    goto :runwrapper
)

REM Common Java install locations
for %%p in (
    "C:\Program Files\Java\jdk-17\bin"
    "C:\Program Files\Java\jdk-21\bin"
    "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot\bin"
    "C:\Program Files\Eclipse Adoptium\jdk-17.0.9.9-hotspot\bin"
    "C:\Program Files\Eclipse Adoptium\jdk-21\bin"
    "C:\Program Files\OpenJDK\bin"
    "C:\Program Files\Amazon Corretto\jdk17\bin"
    "C:\Program Files\Amazon Corretto\jdk21\bin"
) do (
    if exist %%p\java.exe (
        set JAVA_HOME=%%~dp0
        set JAVA_HOME=!JAVA_HOME:~0,-5!
        set PATH=%%p;%PATH%
        echo Found Java at %%p
        goto :runwrapper
    )
)

echo ERROR: Java not found. Please install Java 17 or 21.
echo Download from: https://adoptium.net
pause
exit /b 1

:runwrapper
echo.
echo Starting Spring Boot backend on port 8080...
echo (Press CTRL+C to stop)
echo.
call mvnw.cmd spring-boot:run
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo If mvnw failed, trying direct java -jar...
    if exist target\examseat-backend-1.0.0.jar (
        java -jar target\examseat-backend-1.0.0.jar
    ) else (
        echo Build the jar first: mvnw.cmd package -DskipTests
    )
)
pause
