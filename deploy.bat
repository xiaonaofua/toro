@echo off
echo ==========================================
echo      Water Lantern Project Deploy to GitHub
echo ==========================================
echo.

REM Check if we're in the correct directory
if not exist "package.json" (
    echo Error: package.json not found. Please run this script from project root directory.
    pause
    exit /b 1
)

echo Checking Git status...
git status

echo.
echo Adding all files to staging area...
git add .

echo.
echo Please enter commit message (press Enter for default):
set /p "commit_msg=Commit message: "

if "%commit_msg%"=="" (
    set "commit_msg=Update water lantern app - %date% %time%"
)

echo.
echo Committing changes...
git commit -m "%commit_msg%"

if %errorlevel% neq 0 (
    echo No changes to commit or commit failed
    echo.
)

echo.
echo Checking remote repository connection...
git remote -v

REM Check if remote origin is already set
git remote get-url origin >nul 2>&1
if %errorlevel% neq 0 (
    echo Adding remote repository...
    git remote add origin https://github.com/xiaonaofua/toro.git
) else (
    echo Remote repository is already set
)

echo.
echo Pushing to GitHub...
git push -u origin main

if %errorlevel% neq 0 (
    echo Push to main failed, trying master branch...
    git push -u origin master
    
    if %errorlevel% neq 0 (
        echo Push failed! Possible reasons:
        echo    1. Network connection issue
        echo    2. GitHub authentication issue
        echo    3. Branch name issue
        echo.
        echo Please manually run:
        echo    git push -u origin main
        echo    or
        echo    git push -u origin master
        pause
        exit /b 1
    )
)

echo.
echo Successfully published to GitHub!
echo Project URL: https://github.com/xiaonaofua/toro
echo.
echo To deploy to Vercel:
echo    1. Visit https://vercel.com
echo    2. Login and select "Import Project"
echo    3. Import GitHub repository: xiaonaofua/toro
echo    4. Click Deploy to complete deployment
echo.

pause