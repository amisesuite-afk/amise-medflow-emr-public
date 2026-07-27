@echo off
echo  Registering MedFlow Watcher as a Windows auto-start service...
echo.

:: Register pm2 to start on Windows boot
call pm2 start index.js --name medflow-watcher --restart-delay=5000
call pm2-startup install
call pm2 save

echo.
echo  Done. The watcher will now start automatically when Windows boots.
echo.
echo  Useful commands:
echo    pm2 logs medflow-watcher    - view live logs
echo    pm2 stop medflow-watcher    - stop the watcher
echo    pm2 restart medflow-watcher - restart it
echo    pm2 list                    - show status
echo.
pause
