@echo off
setlocal enabledelayedexpansion
title Field Sense - Routine Water Refresh
cd /d "%~dp0"
color 0F
mode con: cols=104 lines=48

echo.
echo  ========================================================================
echo    FIELD SENSE - ROUTINE WATER REFRESH
echo  ========================================================================
echo.
echo   This is the NORMAL maintenance run.
echo.
echo   It refreshes the 220 OLDEST source checks, then moves those records to
echo   the back of the queue. Run it again later and the next-oldest records
echo   rise to the top. It does NOT reread all 1,000+ waters every time.
echo.
echo   It also reruns catalog enrichment and station/location binding after
echo   the source refresh.
echo.
echo   Existing wording is additive by default. An unreadable page does not
echo   delete or retire a water.
echo.
echo  ------------------------------------------------------------------------
echo.
pause
echo.

REM ---------------------------------------------------------------- step 1
echo  [1/7] Checking the local repository...
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
echo.

REM ---------------------------------------------------------------- step 2
echo  [2/7] Taking the BEFORE health reading...
call node scripts\pipeline\health.mjs > "BEFORE-REFRESH-health.txt" 2>&1
echo        Saved to BEFORE-REFRESH-health.txt
echo.

REM ---------------------------------------------------------------- step 3
echo  [3/7] Re-reading the 220 oldest official source pages...
echo.
echo        Refreshed records get a 60-day raw review date. The app itself
echo        spreads review cadence so the catalog does not all fall due at once.
echo.
echo  ------------------------------------------------------------------------
call node scripts\pipeline\refresh.mjs --batch=220 --concurrency=4 --review-days=60
if errorlevel 1 (
  echo.
  echo   ^>^> Refresh stopped early. Review the messages above.
  echo.
  pause
  exit /b 1
)
echo  ------------------------------------------------------------------------
echo.

REM ---------------------------------------------------------------- step 4
echo  [4/7] Re-applying agency/regulation enrichment...
call node scripts\enrich-catalog.mjs
if errorlevel 1 (
  echo   ^>^> WARNING: catalog enrichment did not finish.
)
echo.

REM ---------------------------------------------------------------- step 5
echo  [5/7] Re-resolving location, gauge/tide and weather bindings...
call node scripts\resolve-stations.mjs
if errorlevel 1 (
  echo   ^>^> WARNING: station resolution did not finish. Existing bindings remain.
)
echo.

REM ---------------------------------------------------------------- step 6
echo  [6/7] Running integrity checks and tests...
call node scripts\assert-catalog.mjs
if errorlevel 1 (
  echo.
  echo   ^>^> STOPPED. Catalog integrity check failed. Do not commit.
  echo.
  pause
  exit /b 1
)
call node --test scripts/pipeline/*.test.mjs > "refresh-tests.txt" 2>&1
findstr /C:"# fail 0" "refresh-tests.txt" >nul
if errorlevel 1 (
  echo.
  echo   ^>^> STOPPED. Pipeline tests failed. Review refresh-tests.txt.
  echo.
  pause
  exit /b 1
)
echo        Checks passed.
echo.

REM ---------------------------------------------------------------- step 7
echo  [7/7] Taking the AFTER health reading...
call node scripts\pipeline\health.mjs > "AFTER-REFRESH-health.txt" 2>&1
echo.
echo  ========================================================================
echo    ROUTINE REFRESH COMPLETE
echo  ========================================================================
echo.
echo   BEFORE:
findstr /C:"past their own review date" /C:"over 180 days" "BEFORE-REFRESH-health.txt"
echo.
echo   AFTER:
findstr /C:"past their own review date" /C:"over 180 days" "AFTER-REFRESH-health.txt"
echo.
echo   Files for comparison:
echo     BEFORE-REFRESH-health.txt
echo     AFTER-REFRESH-health.txt
echo.
echo  ========================================================================
echo.

echo   Save the resulting DATA changes to GitHub?
echo.
echo     Y = commit and push
echo     N = leave the results only on this computer
echo.
set /p SAVE="   Type Y or N then press Enter: "
if /i not "!SAVE!"=="Y" goto finish

echo.
git add src/data reports
git commit -m "data: refresh oldest Field Sense water records"
if errorlevel 1 (
  echo   Nothing new to commit.
  goto finish
)
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
