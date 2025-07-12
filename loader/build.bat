@echo off
echo Building Soryn Security Loader - Production Version
echo Excluding all test files and development artifacts...
echo.

REM Check if Visual Studio is installed
where cl >nul 2>&1
if %errorlevel% neq 0 (
    echo Visual Studio not found in PATH
    echo Please run this from a Visual Studio Developer Command Prompt
    echo or set up the environment variables manually
    pause
    exit /b 1
)

REM Create build directory
if not exist build mkdir build
cd build

REM Configure with CMake - Production settings only
echo Configuring with CMake for production build...
cmake .. -G "Visual Studio 16 2019" -A x64 -DCMAKE_BUILD_TYPE=Release -DPRODUCTION_BUILD=ON

if %errorlevel% neq 0 (
    echo CMake configuration failed
    pause
    exit /b 1
)

REM Build the project
echo Building production loader...
cmake --build . --config Release

if %errorlevel% neq 0 (
    echo Build failed
    pause
    exit /b 1
)

REM Copy executable to parent directory
echo Copying production executable...
copy Release\SorynLoader.exe ..\SorynLoader.exe

if %errorlevel% neq 0 (
    echo Failed to copy executable
    pause
    exit /b 1
)

REM Create production package directory
cd ..
if not exist production mkdir production
if not exist production\config mkdir production\config
if not exist production\logs mkdir production\logs

REM Copy only production files
echo Creating production package...
copy SorynLoader.exe production\
copy backend\.env.template production\config\settings.template

REM Create production README
echo Creating production documentation...
(
echo Soryn Security Loader - Production Version
echo.
echo This is the production version of the Soryn Security Loader.
echo.
echo SECURITY FEATURES:
echo - Anti-debugging protection
echo - Anti-VM detection  
echo - Anti-sandbox detection
echo - Hardware fingerprinting
echo - Encrypted payload execution
echo - System cleanup on compromise
echo.
echo REQUIREMENTS:
echo - Windows 10/11
echo - Administrator privileges
echo - Internet connection for license validation
echo.
echo USAGE:
echo Run SorynLoader.exe as administrator
echo.
echo WARNING:
echo This loader implements aggressive security measures.
echo Use at your own risk and ensure compliance with local laws.
echo.
echo For support, contact your system administrator.
) > production\README.txt

REM Clean up build artifacts
echo Cleaning up build artifacts...
cd build
rmdir /s /q CMakeFiles 2>nul
rmdir /s /q Release 2>nul
rmdir /s /q Debug 2>nul
rmdir /s /q x64 2>nul
del CMakeCache.txt 2>nul
del cmake_install.cmake 2>nul
cd ..

REM Verify production package
echo.
echo === Production Package Created ===
echo.
echo Production files:
dir production /b
echo.
echo Configuration files:
dir production\config /b
echo.
echo Build completed successfully!
echo.
echo Production package location: production\
echo.
echo SECURITY VERIFICATION:
echo - Source code excluded from production
echo - Test files excluded from production
echo - Build artifacts cleaned up
echo - Only compiled binary included
echo.
echo Next steps:
echo 1. Test the production loader thoroughly
echo 2. Configure backend settings
echo 3. Deploy to production environment
echo 4. Monitor security logs
echo.
echo WARNING: This loader requires administrator privileges
echo and will perform aggressive security measures if compromised.
echo.
pause 