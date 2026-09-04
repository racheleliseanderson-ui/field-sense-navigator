@echo off
setlocal enabledelayedexpansion
title Field Sense - Full Catalog Refresh
cd /d "%~dp0"
color 0F
mode con: cols=104 lines=48

echo.
echo  ========================================================================
echo    FIELD SENSE - FULL CATALOG REFRESH
echo  ========================================================================
echo.
echo   This is the occasional DEEP SWEEP. It rereads every catalog record.
echo   Use RUN-REFRESH.bat for normal maintenance; use this when you actually
echo   want a complete source sweep.
echo.
echo  ------------------------------------------------------------------------
echo.
pause

echo  [1/6] Checking prerequisites...
where node >nul 2>&1
if errorlevel 1 (
  echo   ^>^> STOPPED. Node.js is not installed.
  pause
  exit /b 1
)
where git >nul 2>&1
if errorlevel 1 (
  echo   ^>^> STOPPED. Git is not installed or is not on PATH.
  pause
  exit /b 1
)
if not exist "src\data\destinations.json" (
  echo   ^>^> STOPPED. Run this BAT from the Field Sense repository root.
  pause
  exit /b 1
)
if exist ".git\index.lock" del /f /q ".git\index.lock" >nul 2>&1

echo  [2/6] Taking BEFORE health reading...
call node scripts\pipeline\health.mjs > "BEFORE-FULL-REFRESH-health.txt" 2>&1

echo  [3/6] Re-reading every official source page...
call node scripts\pipeline\refresh.mjs --all --concurrency=4 --review-days=60
if errorlevel 1 (
  echo   ^>^> Full refresh stopped early.
  pause
  exit /b 1
)

echo  [4/6] Re-applying enrichment and station/location bindings...
call node scripts\enrich-catalog.mjs
call node scripts\resolve-stations.mjs

echo  [5/6] Running checks...
call node scripts\assert-catalog.mjs
if errorlevel 1 (
  echo   ^>^> STOPPED. Catalog integrity check failed. Do not commit.
  pause
  exit /b 1
)
call node --test scripts/pipeline/*.test.mjs > "full-refresh-tests.txt" 2>&1
findstr /C:"# fail 0" "full-refresh-tests.txt" >nul
if errorlevel 1 (
  echo   ^>^> STOPPED. Pipeline tests failed. Review full-refresh-tests.txt.
  pause
  exit /b 1
)

echo  [6/6] Taking AFTER health reading...
call node scripts\pipeline\health.mjs > "AFTER-FULL-REFRESH-health.txt" 2>&1

echo.
echo  ========================================================================
echo    FULL REFRESH COMPLETE
echo  ========================================================================
echo.

echo   Save the resulting DATA changes to GitHub?
echo.
echo     Y = commit and push
echo     N = leave the results only on this computer
echo.
set /p SAVE="   Type Y or N then press Enter: "
if /i not "!SAVE!"=="Y" goto finish

git add src/data reports
git commit -m "data: full Field Sense catalog source refresh"
if errorlevel 1 goto finish
git push
if errorlevel 1 (
  echo   Commit saved locally, but git push failed. Run git push after fixing access.
) else (
  echo   Saved and uploaded.
)

:finish
echo.
pause
endlocal
