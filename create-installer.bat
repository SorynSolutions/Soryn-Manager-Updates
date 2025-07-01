@echo off
echo Creating installer executable...

:: Check if 7-Zip is installed
where 7z >nul 2>nul
if %errorlevel% neq 0 (
    echo 7-Zip is not installed! Please install 7-Zip first.
    echo Download from: https://www.7-zip.org/
    pause
    exit /b 1
)

:: Create a temporary directory for the installer
if exist temp_installer rmdir /s /q temp_installer
mkdir temp_installer
copy install-dependencies.bat temp_installer\

:: Create a 7z archive
7z a -t7z temp_installer.7z temp_installer\*

:: Create the SFX module
echo Creating self-extracting executable...
7z a -sfx7z.sfx install-dependencies.exe temp_installer.7z

:: Clean up
rmdir /s /q temp_installer
del temp_installer.7z

echo.
if exist install-dependencies.exe (
    echo Installer executable has been created successfully: install-dependencies.exe
    dir install-dependencies.exe
) else (
    echo Failed to create installer executable.
)
echo.
pause 