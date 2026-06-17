@echo off
title Mahekk Scanner Server - STOPPING
echo Stopping Mahekk Industry Drawing Quotation Scanner...

:: Find and kill process on port 3000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    echo Killing process PID %%a on port 3000...
    taskkill /f /pid %%a
)

:: Alternative fallback: kill node.exe processes
echo Checking for any remaining node.exe processes...
taskkill /f /im node.exe 2>nul

echo.
echo All running servers stopped successfully!
echo.
pause
