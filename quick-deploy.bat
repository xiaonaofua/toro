@echo off
git add .
git commit -m "new update"
git remote add origin https://github.com/xiaonaofua/toro.git 2>nul
git push origin main
if %errorlevel% neq 0 git push origin master
echo Done! Check: https://github.com/xiaonaofua/toro
pause