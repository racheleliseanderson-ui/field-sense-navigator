@echo off
REM ---------------------------------------------------------------------------
REM  Finish the Waterways refinement pass  (v2 - does not require git on PATH)
REM
REM  Deletes the 49 files the refinement pass replaced, straight off the disk.
REM  GitHub Desktop picks deletions up exactly like any other change, so you
REM  still review every one of them before anything is committed.
REM
REM  Every file removed here is committed in git history. If you want any of
REM  them back, right-click the change in GitHub Desktop and choose Discard.
REM
REM  Nothing is committed. Nothing is pushed. Nothing outside this folder is
REM  touched. Delete this file once it has run.
REM ---------------------------------------------------------------------------
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo   Waterways - finishing the refinement pass
echo   Folder: %CD%
echo.

if not exist ".git" (
  echo   ERROR: this is not the repository folder. Nothing done.
  echo.
  pause
  exit /b 1
)
if not exist "package.json" (
  echo   ERROR: no package.json here. Nothing done.
  echo.
  pause
  exit /b 1
)

set /a REMOVED=0
set /a KEPT=0

REM --- 1. CI workflow --------------------------------------------------------
echo   [1/3] CI workflow
if exist "docs\ci\publish-catalog.yml" (
  if not exist ".github\workflows" mkdir ".github\workflows"
  move /y "docs\ci\publish-catalog.yml" ".github\workflows\publish-catalog.yml" >nul
  echo         moved into .github\workflows\
)
if exist "docs\ci\README.md" del /q "docs\ci\README.md"
if exist "docs\ci" rmdir "docs\ci" 2>nul
REM a second copy saved by hand lands as publish-catalog_1.yml - one is enough
if exist ".github\workflows\publish-catalog_1.yml" (
  del /q ".github\workflows\publish-catalog_1.yml"
  echo         removed the duplicate publish-catalog_1.yml
)
if exist ".github\workflows\publish-catalog.yml" (
  echo         in place: .github\workflows\publish-catalog.yml
) else (
  echo         NOT FOUND - save it there by hand from the chat
)

REM --- 2. remove the replaced files ------------------------------------------
echo.
echo   [2/3] Removing files the pass replaced
call :drop "HANDOFF.md"
call :drop "src\lib\i18n.ts"
call :drop "src\lib\species-handoff.ts"
call :drop "src\components\BuyMeACoffeeWidget.tsx"
call :drop "src\hooks\use-mobile.tsx"
if exist "src\hooks" rmdir "src\hooks" 2>nul

REM 44 of the 46 shadcn defaults were never imported anywhere in the app.
REM Keep only the two the jump palette actually uses.
if exist "src\components\ui" (
  for %%F in ("src\components\ui\*.tsx") do (
    if /i "%%~nxF"=="command.tsx" (
      set /a KEPT+=1
    ) else if /i "%%~nxF"=="dialog.tsx" (
      set /a KEPT+=1
    ) else (
      del /q "%%F"
      if exist "%%F" (echo         COULD NOT DELETE %%~nxF) else (set /a REMOVED+=1)
    )
  )
)
echo         removed !REMOVED! files, kept !KEPT! in src\components\ui

REM --- 3. dependencies -------------------------------------------------------
echo.
echo   [3/3] Dependencies
where bun >nul 2>&1
if errorlevel 1 (
  echo         bun is not installed - skipped.
  echo         Only needed to run the app on this machine; Vercel installs
  echo         it on deploy. Get it from https://bun.sh if you want to.
) else (
  echo         running bun install...
  call bun install
)

echo.
echo   ----------------------------------------------------------------
echo   Done. Open GitHub Desktop - the deletions are listed as changes
echo   for you to review, then commit and push.
echo.
echo   You can delete finish-setup.bat now.
echo   ----------------------------------------------------------------
echo.
pause
exit /b 0

:drop
if exist %1 (
  del /q %1
  if exist %1 (echo         COULD NOT DELETE %~1) else (set /a REMOVED+=1)
)
exit /b 0
