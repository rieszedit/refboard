@echo off
echo ===================================================
echo   RefBoard Landing Page - Manual Deployment Script
echo ===================================================
echo.

echo [1/5] Staging and Committing changes in landing folder...
git add landing
git commit -m "Update landing page (Manual Deploy)" 
REM Continue even if nothing to commit
if %ERRORLEVEL% NEQ 0 echo No changes to commit or commit failed. Continuing...

echo.
echo [2/5] Pushing 'main' branch to remote...
git push origin main

echo.
echo [3/5] Preparing gh-pages subtree...
REM Clean up previous temp branch if it exists
git branch -D gh-pages-temp 2>nul
REM Split the landing folder into a new temporary branch
git subtree split --prefix landing -b gh-pages-temp

echo.
echo [4/5] Force pushing to 'gh-pages'...
git push origin gh-pages-temp:gh-pages --force

echo.
echo [5/5] Cleaning up specific temporary branches...
git branch -D gh-pages-temp

echo.
echo ===================================================
echo   Deployment Complete!
echo   Please wait a few minutes and then Hard Refresh:
echo   https://refboard.win/
echo ===================================================
pause
