@echo off
setlocal enabledelayedexpansion
title Field Sense - Keep Waters Current
cd /d "%~dp0"
color 0F
mode con: cols=100 lines=45

echo.
echo  ================================================================
echo    FIELD SENSE - KEEP WATERS CURRENT
echo  ================================================================
echo.
echo   This re-opens each water's own agency page and brings what it
echo   says up to date - new closures, new advisories, new ramps and
echo   piers, and a fresh review date.
echo.
echo   It ADDS what the page now says. It does not delete wording a
echo   person put there, because "I could not find it" and "it is
echo   gone" are not the same thing.
echo.
echo   A page that will not load does NOT retire the water. The record
echo   is kept exactly as it was and listed for you to look at.
echo.
echo   It takes about AN HOUR for the whole catalogue. You do not have
echo   to watch it. You can stop any time by closing this window -
echo   nothing breaks, and running it again picks up the oldest ones
echo   first.
echo.
echo   Leave your laptop plugged in and awake.
echo.
echo  ----------------------------------------------------------------
echo.
pause
echo.

REM ---------------------------------------------------------------- step 1
REM Nothing here installs anything. Every script this file runs uses only
REM what Node itself provides, so the website's packages are not needed and
REM a failed package install cannot stop a refresh.
echo  [1/6] Checking your computer has what it needs...
where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo   ^>^> STOPPED. Node.js is not installed on this computer.
  echo.
  echo      Go to    https://nodejs.org
  echo      Click the big green "LTS" button, install it,
  echo      then RESTART this file.
  echo.
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODEV=%%v
echo        Node.js !NODEV! - good. Nothing to install.
if exist ".git\index.lock" (
  del /f /q ".git\index.lock" >nul 2>&1
  echo        Cleared a leftover Git lock file.
)
echo.

REM ---------------------------------------------------------------- step 2
echo  [2/6] Taking a "before" reading, so we can measure the gain...
call node scripts\pipeline\health.mjs > "BEFORE-report.txt" 2>&1
echo        Saved to BEFORE-report.txt
echo.

REM ---------------------------------------------------------------- step 3
echo  [3/6] Re-reading the agency pages. THIS IS THE LONG PART.
echo.
echo        Oldest information first, so a short run still buys the most.
echo        Every water it re-verifies prints a + line.
echo        Every water that needs you prints a - line and the reason.
echo.
echo  ----------------------------------------------------------------
call node scripts\pipeline\refresh.mjs --all --concurrency=4
echo  ----------------------------------------------------------------
echo.
echo        Page reading finished.
echo.

REM ---------------------------------------------------------------- step 4
echo  [4/6] Re-checking which gauge or tide station belongs to each water...
call node scripts\resolve-stations.mjs
if errorlevel 1 (
  echo        The station resolver did not finish. That is not fatal -
  echo        the bindings you already had are untouched.
)
echo.

REM ---------------------------------------------------------------- step 5
echo  [5/6] Making sure nothing broke...
call node scripts\assert-catalog.mjs
if errorlevel 1 (
  echo.
  echo   ^>^> WARNING: the catalogue check did not pass.
  echo      Nothing has been saved to GitHub. Tell Claude.
  echo.
  pause
  exit /b 1
)
call node --test scripts/pipeline/*.test.mjs > "test-results.txt" 2>&1
findstr /C:"# fail 0" "test-results.txt" >nul
if errorlevel 1 (
  echo.
  echo   ^>^> WARNING: some tests did not pass.
  echo      Nothing has been saved to Git. Send test-results.txt to Claude.
  echo.
  pause
  exit /b 1
)
echo        All checks passed.
echo.

REM ---------------------------------------------------------------- step 6
echo  [6/6] Taking an "after" reading...
call node scripts\pipeline\health.mjs > "AFTER-report.txt" 2>&1
echo        Saved to AFTER-report.txt
echo.
echo  ================================================================
echo    DONE. Here is what changed:
echo  ================================================================
echo.
echo   BEFORE:
findstr /C:"past their own review date" /C:"over 180 days" "BEFORE-report.txt"
echo.
echo   AFTER:
findstr /C:"past their own review date" /C:"over 180 days" "AFTER-report.txt"
echo.
echo  ================================================================
echo.

REM ---------------------------------------------------------------- save
echo   Do you want to SAVE these results to GitHub?
echo.
echo     Y = yes, save and upload
echo     N = no, leave everything on this computer only
echo.
set /p SAVE="   Type Y or N then press Enter: "
if /i not "!SAVE!"=="Y" goto finish

echo.
echo   Saving...
git add src/data reports
git commit -m "data: re-read agency pages and refresh what they publish"
if errorlevel 1 (
  echo   Nothing new to save.
  goto finish
)
git push
if errorlevel 1 (
  echo.
  echo   Saved on this computer, but the upload to GitHub failed.
  echo   That is usually a sign-in issue. Your work is safe here.
  echo   Tell Claude "the push failed" and it can sort it out.
) else (
  echo   Saved and uploaded.
)

:finish
echo.
echo  ----------------------------------------------------------------
echo   Send these two files to Claude and it will tell you exactly
echo   what the run bought:
echo.
echo       BEFORE-report.txt
echo       AFTER-report.txt
echo.
echo   The newest refresh file in the reports folder lists every water
echo   that needs a person to look at it.
echo  ----------------------------------------------------------------
echo.
pause
endlocal
