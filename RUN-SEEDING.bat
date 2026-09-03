@echo off
setlocal enabledelayedexpansion
title Field Sense - Find New Waters
cd /d "%~dp0"
color 0F
mode con: cols=100 lines=45

echo.
echo  ================================================================
echo    FIELD SENSE - FIND NEW WATERS
echo  ================================================================
echo.
echo   This looks through the fish and wildlife agencies you already
echo   cite, finds named lakes and rivers you do NOT have yet, opens
echo   each agency's own page for that water, and only keeps the ones
echo   it can prove.
echo.
echo   Anything it cannot prove is DROPPED, never guessed.
echo.
echo   Roughly a minute per 15 waters. You do not have to watch.
echo   You can stop any time by closing this window - nothing breaks.
echo.
echo   Leave your laptop plugged in, awake, and on the internet.
echo.
echo  ----------------------------------------------------------------
echo.
pause
echo.

REM ---------------------------------------------------------------- step 1
echo  [1/7] Checking your computer has what it needs...
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
echo        Node.js !NODEV! - good.
if exist ".git\index.lock" (
  del /f /q ".git\index.lock" >nul 2>&1
  echo        Cleared a leftover Git lock file.
)
if not exist "src\data\destinations.json" (
  echo.
  echo   ^>^> STOPPED. src\data\destinations.json is missing.
  echo      That file is the catalogue itself.
  echo.
  pause
  exit /b 1
)
echo.

REM ---------------------------------------------------------------- step 2
echo  [2/7] Installing the tools the project needs...
echo        (first time only - this can take a few minutes)
if not exist "node_modules\" (
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo   ^>^> STOPPED. The install failed - usually no internet.
    echo.
    pause
    exit /b 1
  )
) else (
  echo        Already installed - skipping.
)
echo.

REM ---------------------------------------------------------------- step 3
echo  [3/7] Counting what you have now...
for /f "tokens=*" %%c in ('node scripts\pipeline\catalog-count.mjs') do set BEFORE=%%c
echo        !BEFORE! waters in the catalogue before this run.
echo.

REM ---------------------------------------------------------------- step 4
echo  [4/7] Asking each agency what waters it publishes...
echo.
echo        This reads the agencies' own site maps. It is quick.
echo.
echo  ----------------------------------------------------------------
call node scripts\pipeline\discover.mjs --limit=200
echo  ----------------------------------------------------------------
echo.

REM ---------------------------------------------------------------- step 5
echo  [5/7] Opening each new water's official page. THIS IS THE LONG PART.
echo.
echo        Every water it proves prints a + line.
echo        Every water it drops prints a - line and the reason.
echo        Silence just means it is still reading one.
echo.
echo  ----------------------------------------------------------------
call node scripts\pipeline\resolve-targets.mjs --concurrency=4
if errorlevel 1 (
  echo.
  echo   ^>^> The lookup stopped early. Nothing was saved.
  echo      Send the messages above to Claude.
  echo.
  pause
  exit /b 1
)
echo  ----------------------------------------------------------------
echo.

REM ---------------------------------------------------------------- step 6
echo  [6/7] Adding what it proved, then checking nothing broke...
call node scripts\pipeline\seed-destinations.mjs
echo.
call node scripts\assert-catalog.mjs
if errorlevel 1 (
  echo.
  echo   ^>^> WARNING: the catalogue check did not pass.
  echo      Nothing has been saved to GitHub. Tell Claude.
  echo.
  pause
  exit /b 1
)
echo.
call node --test scripts/pipeline/*.test.mjs > "pipeline-tests.txt" 2>&1
findstr /C:"# fail 0" "pipeline-tests.txt" >nul
if errorlevel 1 (
  echo   ^>^> WARNING: the pipeline's own tests did not pass.
  echo      Nothing has been saved to GitHub. Send pipeline-tests.txt to Claude.
  echo.
  pause
  exit /b 1
)
echo        Checks passed.
echo.

REM ---------------------------------------------------------------- step 7
echo  [7/7] Counting what you have now...
for /f "tokens=*" %%c in ('node scripts\pipeline\catalog-count.mjs') do set AFTER=%%c
echo.
echo  ================================================================
echo    DONE.
echo  ================================================================
echo.
echo    Before:  !BEFORE! waters
echo    After:   !AFTER! waters
echo.
echo    Everything it could not prove is listed, with the reason, in
echo    the newest resolve-targets file in the reports folder.
echo.
echo    New waters are marked as NOT yet read by a person and are set
echo    to come up for review in 30 days. That is deliberate.
echo.
echo  ================================================================
echo.

echo   Do you want to SAVE these results to GitHub?
echo.
echo     Y = yes, save and upload
echo     N = no, leave everything on this computer only
echo.
set /p SAVE="   Type Y or N then press Enter: "
if /i not "!SAVE!"=="Y" goto finish
echo.
echo   Saving...
git add src/data scripts/data reports
git commit -m "data: seed verified public waters from official agency pages"
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
  echo   Saved and uploaded. GitHub will now rebuild the site data
  echo   and republish the catalogue.
)

:finish
echo.
pause
endlocal
