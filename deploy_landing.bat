@echo off
echo Committing any remaining changes...
git add .
git commit -m "Update landing page"

echo Pushing to main...
git push origin main

echo Deploying landing folder to gh-pages (Force Update)...
REM Clean up temp branch if it exists
git branch -D gh-pages-temp 2>nul

REM Create a temporary branch containing only the landing folder history
git subtree split --prefix landing -b gh-pages-temp

REM Force push this branch to the remote gh-pages branch
git push origin gh-pages-temp:gh-pages --force

REM Clean up
git branch -D gh-pages-temp

echo Done!
pause
