@echo off
echo Removing image files from repository...

git rm -f toronagashi.png 2>nul
git rm -f *.png 2>nul
git rm -f *.jpg 2>nul
git rm -f *.jpeg 2>nul
git rm -f *.gif 2>nul

git add .
git commit -m "remove image files"
git push origin main
if %errorlevel% neq 0 git push origin master

echo Done! Images removed from GitHub repository.
pause