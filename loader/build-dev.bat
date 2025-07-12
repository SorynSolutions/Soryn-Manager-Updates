@echo off
echo Building Soryn Security Loader - Development Version
echo Including test files for development and testing...
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
if not exist build-dev mkdir build-dev
cd build-dev

REM Configure with CMake - Development settings
echo Configuring with CMake for development build...
cmake .. -G "Visual Studio 16 2019" -A x64 -DCMAKE_BUILD_TYPE=Debug -DPRODUCTION_BUILD=OFF

if %errorlevel% neq 0 (
    echo CMake configuration failed
    pause
    exit /b 1
)

REM Build the project
echo Building development loader and tests...
cmake --build . --config Debug

if %errorlevel% neq 0 (
    echo Build failed
    pause
    exit /b 1
)

REM Copy executables to parent directory
echo Copying development executables...
copy Debug\SorynLoader.exe ..\SorynLoader-dev.exe
copy Debug\test-loader.exe ..\test-loader.exe 2>nul
copy Debug\validate-loader.exe ..\validate-loader.exe 2>nul

if %errorlevel% neq 0 (
    echo Failed to copy some executables
    echo This is normal if test files don't exist
)

REM Create development package directory
cd ..
if not exist development mkdir development
if not exist development\tests mkdir development\tests

REM Copy development files
echo Creating development package...
copy SorynLoader-dev.exe development\
copy test-loader.exe development\tests\ 2>nul
copy validate-loader.exe development\tests\ 2>nul
copy test-security.ps1 development\tests\ 2>nul
copy test-keyauth-validation.ps1 development\tests\ 2>nul

REM Create development README
echo Creating development documentation...
(
echo Soryn Security Loader - Development Version
echo.
echo This is the development version of the Soryn Security Loader.
echo Includes test files and debug information.
echo.
echo DEVELOPMENT FEATURES:
echo - Debug symbols included
echo - Test files available
echo - Development logging enabled
echo - Less aggressive security measures
echo.
echo TESTING:
echo - Run test-security.ps1 for security tests
echo - Run test-keyauth-validation.ps1 for KeyAuth tests
echo - Run validate-loader.exe to test the binary
echo - Run test-loader.exe for C++ tests
echo.
echo WARNING:
echo This is a DEVELOPMENT version with reduced security.
echo DO NOT use in production environments.
echo.
echo For production builds, use build.bat instead.
) > development\README.txt

REM Verify development package
echo.
echo === Development Package Created ===
echo.
echo Development files:
dir development /b
echo.
echo Test files:
dir development\tests /b
echo.
echo Build completed successfully!
echo.
echo Development package location: development\
echo.
echo DEVELOPMENT FEATURES:
echo - Source code included for debugging
echo - Test files included for validation
echo - Debug symbols preserved
echo - Development logging enabled
echo.
echo Next steps:
echo 1. Run security tests: test-security.ps1
echo 2. Test KeyAuth validation: test-keyauth-validation.ps1
echo 3. Validate binary: validate-loader.exe
echo 4. Test C++ features: test-loader.exe
echo 5. When ready, use build.bat for production
echo.
echo WARNING: This is a DEVELOPMENT version
echo with reduced security measures.
echo.
pause 