@echo off
setlocal enabledelayedexpansion
title Field Sense - Balanced New Water Seeding
cd /d "%~dp0"
color 0F
mode con: cols=104 lines=48

echo.
echo  ========================================================================
echo    FIELD SENSE - BALANCED NEW WATER SEEDING
echo  ========================================================================
echo.
echo   This run is built to EXPAND coverage, not keep mining the states that
echo   already have the most waters.
echo.
echo   It does four separate jobs:
echo     1. Ask the least-covered jurisdictions first for new candidates.
echo     2. Prove each candidate against its official agency page.
echo     3. Add only proved waters.
echo     4. Immediately enrich agency/regulation fields and resolve location,
echo        gauge/tide and weather-station bindings for the new catalog.
echo.
echo   Nothing is guessed. A field the official sources cannot prove stays
echo   empty and remains visible as a gap.
echo.
echo   Leave the laptop plugged in, awake and online.
echo.
echo  ------------------------------------------------------------------------
echo.
pause
echo.

REM ---------------------------------------------------------------- step 1
echo  [1/8] Checking the local repository...
where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo   ^>^> STOPPED. Node.js is not installed.
  echo      Install the current Node.js LTS release, then run this again.
  echo.
  pause
  exit /b 1
)
where git >nul 2>&1
if errorlevel 1 (
  echo.
  echo   ^>^> STOPPED. Git is not installed or is not on PATH.
  echo.
  pause
  exit /b 1
)
if not exist "src\data\destinations.json" (
  echo.
  echo   ^>^> STOPPED. This BAT must sit in the Field Sense repository root.
  echo      src\data\destinations.json was not found.
  echo.
  pause
  exit /b 1
)
if not exist "scripts\pipeline\discover-balanced.mjs" (
  echo.
  echo   ^>^> STOPPED. scripts\pipeline\discover-balanced.mjs is missing.
  echo      Pull the current field-sense-navigator repository first.
  echo.
  pause
  exit /b 1
)
if exist ".git\index.lock" del /f /q ".git\index.lock" >nul 2>&1
for /f "tokens=*" %%v in ('node -v') do set NODEV=%%v
echo        Node.js !NODEV! - good.
echo.

REM ---------------------------------------------------------------- step 2
echo  [2/8] Taking the BEFORE reading...
for /f "tokens=*" %%c in ('node scripts\pipeline\catalog-count.mjs') do set BEFORE=%%c
call node scripts\pipeline\health.mjs > "BEFORE-SEED-health.txt" 2>&1
echo        !BEFORE! waters before this run.
echo        Health snapshot: BEFORE-SEED-health.txt
echo.

REM ---------------------------------------------------------------- step 3
echo  [3/8] Finding new waters from the LEAST-COVERED jurisdictions first...
echo.
echo        Target: up to 200 new questions, normally no more than 8 from
echo        one jurisdiction before moving to the next.
echo.
echo  ------------------------------------------------------------------------
call node scripts\pipeline\discover-balanced.mjs --target=200 --per-state=8 --jurisdictions=45 --concurrency=3
if errorlevel 1 (
  echo.
  echo   ^>^> Balanced discovery returned an error.
  echo      Nothing has been added to the catalog yet.
  echo.
  pause
  exit /b 1
)
echo  ------------------------------------------------------------------------
echo.

REM ---------------------------------------------------------------- step 4
echo  [4/8] Proving every unresolved candidate against its official page...
echo.
echo        A + line means proved. A - line means rejected or unresolved.
echo        Rejection is expected; it prevents weak records from entering.
echo.
echo  ------------------------------------------------------------------------
call node scripts\pipeline\resolve-targets.mjs --concurrency=4
if errorlevel 1 (
  echo.
  echo   ^>^> Candidate resolution stopped early. No catalog write will occur.
  echo.
  pause
  exit /b 1
)
echo  ------------------------------------------------------------------------
echo.

REM ---------------------------------------------------------------- step 5
echo  [5/8] Adding proved waters...
call node scripts\pipeline\seed-destinations.mjs
if errorlevel 1 (
  echo.
  echo   ^>^> Seeding failed. Stop here and review the newest seed report.
  echo.
  pause
  exit /b 1
)
echo.

REM ---------------------------------------------------------------- step 6
echo  [6/8] Filling the machine-provable supporting criteria...
echo.
echo        - supplemental official pages for missing access/species evidence
echo        - managing agency and regulations URL
echo        - related-water links where the catalog can prove them
echo        - public location lookup
echo        - gauge / tide binding where a defensible match exists
echo        - weather-station binding for located US waters
echo.
call node scripts\pipeline\complete-seeded.mjs --days=3 --limit=150 --concurrency=3
if errorlevel 1 (
  echo   ^>^> WARNING: supplemental official-source completion did not finish.
  echo      The primary-source seed is still intact; unresolved fields stay empty.
)
call node scripts\enrich-catalog.mjs
if errorlevel 1 (
  echo   ^>^> WARNING: catalog enrichment did not finish.
  echo      The seeded waters are still present; missing enrichment remains visible.
)
call node scripts\resolve-stations.mjs
if errorlevel 1 (
  echo   ^>^> WARNING: station/location resolution did not finish.
  echo      Existing bindings remain usable; rerun later to fill misses.
)
echo.

REM ---------------------------------------------------------------- step 7
echo  [7/8] Running catalog and pipeline checks...
call node scripts\assert-catalog.mjs
if errorlevel 1 (
  echo.
  echo   ^>^> STOPPED. The catalog integrity check failed.
  echo      Do not commit these data changes until the failure is reviewed.
  echo.
  pause
  exit /b 1
)
call node --test scripts/pipeline/*.test.mjs > "pipeline-tests.txt" 2>&1
findstr /C:"# fail 0" "pipeline-tests.txt" >nul
if errorlevel 1 (
  echo.
  echo   ^>^> STOPPED. Pipeline tests failed.
  echo      Review pipeline-tests.txt before committing.
  echo.
  pause
  exit /b 1
)
echo        Checks passed.
echo.

REM ---------------------------------------------------------------- step 8
echo  [8/8] Taking the AFTER reading...
for /f "tokens=*" %%c in ('node scripts\pipeline\catalog-count.mjs') do set AFTER=%%c
call node scripts\pipeline\health.mjs > "AFTER-SEED-health.txt" 2>&1
set /a ADDED=!AFTER!-!BEFORE!
echo.
echo  ========================================================================
echo    SEEDING COMPLETE
echo  ========================================================================
echo.
echo    Before:  !BEFORE!
echo    After:   !AFTER!
echo    Added:   !ADDED!
echo.
echo    Compare:
echo      BEFORE-SEED-health.txt
echo      AFTER-SEED-health.txt
echo.
echo    The newest balanced-discovery, resolve-targets and seed reports in
echo    reports\ show exactly what was asked, rejected and added.
echo.
echo  ========================================================================
echo.

echo   Save the resulting DATA changes to GitHub?
echo.
echo     Y = commit and push the data/reports
echo     N = leave the results only on this computer
echo.
set /p SAVE="   Type Y or N then press Enter: "
if /i not "!SAVE!"=="Y" goto finish

echo.
echo   Saving...
git add src/data scripts/data reports
git commit -m "data: balanced water discovery and post-seed enrichment"
if errorlevel 1 (
  echo   Nothing new to commit.
  goto finish
)
git push
if errorlevel 1 (
  echo.
  echo   The commit is safe on this computer, but git push failed.
  echo   Fix the GitHub sign-in/network issue and run: git push
) else (
  echo   Saved and uploaded.
)

:finish
echo.
pause
endlocal
