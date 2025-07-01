 @echo off
echo Installing dependencies for Soryn's Lobby Manager...

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js is not installed! Please install Node.js first.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

:: Check if npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo npm is not installed! Please install Node.js first.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

:: Install dependencies
echo.
echo Installing main dependencies...
call npm install axios@1.9.0
call npm install electron-store@8.1.0
call npm install systeminformation@5.21.0
call npm install uuid@9.0.1

echo.
echo Installing development dependencies...
call npm install --save-dev electron@29.0.1
call npm install --save-dev electron-builder@24.13.0
call npm install --save-dev glob@10.3.10

echo.
echo All dependencies have been installed successfully!
echo.
echo You can now run the application by opening:
echo SorynsManager_v3.exe
echo.
echo.
pause 