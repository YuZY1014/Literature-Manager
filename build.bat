@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo   Literature Manager - Build Script
echo ============================================
echo.

pip show pyinstaller >nul 2>&1
if %errorlevel% neq 0 (
    echo [1/3] Installing PyInstaller...
    pip install pyinstaller
) else (
    echo [1/3] PyInstaller found, skipping.
)

echo [2/3] Cleaning old build...
if exist "dist\*" rmdir /s /q "dist" 2>nul
if exist "build" rmdir /s /q "build" 2>nul
if exist "__pycache__" rmdir /s /q "__pycache__" 2>nul
if exist "*.spec" del /q "*.spec" 2>nul

echo [3/3] Building... (about 2-5 minutes)
echo.

pyinstaller --onedir --name "LiteratureManager" --add-data "static;static" --collect-all pymupdf main.py

if %errorlevel% equ 0 (
    echo.
    echo ============================================
    echo   Build successful!
    echo   Output: dist\LiteratureManager\
    echo.
    echo   Usage:
    echo     1. Copy the whole "dist\LiteratureManager"
    echo        folder to any location
    echo     2. Double click LiteratureManager.exe
    echo     3. Browser opens http://127.0.0.1:8088
    echo ============================================
) else (
    echo.
    echo Build failed. Check error messages above.
)

pause
