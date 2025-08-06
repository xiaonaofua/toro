@echo off
cls
echo ==========================================
echo      Deploy to GitHub
echo ==========================================
echo.

if not exist "package.json" (
    echo Error: package.json not found
    pause
    exit /b 1
)

echo Adding files...
git add .

echo Committing...
git commit -m "new update"

echo Setting remote if needed...
git remote get-url origin >nul 2>&1
if %errorlevel% neq 0 (
    git remote add origin https://github.com/xiaonaofua/toro.git
)

echo Pushing to GitHub...
git push origin main
if %errorlevel% neq 0 (
    git push origin master
)

if %errorlevel% equ 0 (
    echo.
    echo SUCCESS: Published to GitHub
    echo URL: https://github.com/xiaonaofua/toro
) else (
    echo.
    echo FAILED: Check your Git setup
)

echo.
pause