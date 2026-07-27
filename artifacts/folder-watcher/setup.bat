@echo off
echo.
echo  MedFlow Document Watcher - First-time Setup
echo  =============================================
echo.

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js is not installed.
    echo.
    echo  Please download and install Node.js from:
    echo    https://nodejs.org/  (choose the LTS version)
    echo.
    echo  Then re-run this setup script.
    pause
    exit /b 1
)

echo  Node.js found:
node --version
echo.

:: Install dependencies
echo  Installing dependencies...
call npm install
if errorlevel 1 (
    echo.
    echo  [ERROR] npm install failed. Check your internet connection and try again.
    pause
    exit /b 1
)
echo.

:: Check for .env file
if not exist ".env" (
    echo  Creating .env from template...
    copy .env.template .env >nul
    echo.
    echo  *** ACTION REQUIRED ***
    echo  Open the .env file in Notepad and fill in:
    echo    WATCH_FOLDER   - path to your incoming documents folder
    echo    SUPABASE_URL   - from Supabase dashboard
    echo    SUPABASE_SERVICE_ROLE_KEY - from Supabase dashboard
    echo.
    echo  After saving .env, run start.bat to begin watching.
    echo.
    notepad .env
) else (
    echo  .env already exists.
)

:: Install pm2 for auto-start on Windows boot
echo.
echo  Installing pm2 (process manager for auto-start)...
call npm install -g pm2
call npm install -g pm2-windows-startup
echo.

echo  Setup complete.
echo.
echo  NEXT STEPS:
echo    1. Edit .env with your Supabase credentials (if not done already)
echo    2. Run start.bat  to test the watcher manually
echo    3. Run autostart.bat  to register it as a Windows startup service
echo.
pause
