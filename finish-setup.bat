@echo off
REM ---------------------------------------------------------------------------
REM  Finish the Waterways refinement pass.
REM
REM  Three things, none of which commits or pushes anything:
REM    1. Move the CI workflow into .github\workflows\ so GitHub will run it.
REM    2. Remove the 49 unused scaffold files the pass replaced. They stay in
REM       git history -- "git checkout HEAD -- <path>" brings any of them back.
REM    3. Sync node_modules to the new lockfile, if bun is installed.
REM
REM  It finishes by showing you "git status" so you can review and push exactly
REM  as you planned. Delete this file afterwards; it is not part of the app.
REM ---------------------------------------------------------------------------
setlocal
cd /d "%~dp0"

echo.
echo   Waterways - finishing the refinement pass
echo   Repository: %CD%
echo.

if not exist ".git" (
  echo   ERROR: this folder is not a git repository. Nothing done.
  echo.
  pause
  exit /b 1
)

REM --- 1. CI workflow --------------------------------------------------------
echo   [1/3] CI workflow
if exist ".github\workflows\publish-catalog.yml" goto :wf_done
if not exist "docs\ci\publish-catalog.yml" (
  echo         staged copy not found - skipping
  goto :wf_done
)
if not exist ".github\workflows" mkdir ".github\workflows"
move /y "docs\ci\publish-catalog.yml" ".github\workflows\publish-catalog.yml" >nul
if exist "docs\ci\README.md" del /q "docs\ci\README.md"
rmdir "docs\ci" 2>nul
git add ".github/workflows/publish-catalog.yml" >nul 2>&1
echo         moved into .github\workflows\
goto :wf_next
:wf_done
echo         already in place - skipping
:wf_next

REM --- 2. remove the replaced scaffold ---------------------------------------
echo   [2/3] Removing replaced files
git rm -q --ignore-unmatch -- "HANDOFF.md" >nul 2>&1
git rm -q --ignore-unmatch -- "src/hooks/use-mobile.tsx" >nul 2>&1
git rm -q --ignore-unmatch -- "src/lib/i18n.ts" >nul 2>&1
git rm -q --ignore-unmatch -- "src/lib/species-handoff.ts" >nul 2>&1
git rm -q --ignore-unmatch -- "src/components/BuyMeACoffeeWidget.tsx" >nul 2>&1

REM 44 of the 46 shadcn defaults were never imported anywhere. Drop the folder,
REM then restore the only two the jump palette actually uses.
git rm -q -r --ignore-unmatch -- "src/components/ui" >nul 2>&1
git checkout HEAD -- "src/components/ui/command.tsx" "src/components/ui/dialog.tsx" >nul 2>&1
echo         done

REM --- 3. dependencies -------------------------------------------------------
echo   [3/3] Dependencies
where bun >nul 2>&1
if errorlevel 1 (
  echo         bun not found - skipping. Only needed to run the app on this
  echo         machine; Vercel installs it on deploy. See https://bun.sh
) else (
  echo         running bun install...
  call bun install
)

REM --- what changed ----------------------------------------------------------
echo.
echo   ----------------------------------------------------------------
echo   Result - nothing committed, nothing pushed:
echo   ----------------------------------------------------------------
git status --short --untracked-files=no
echo.
echo   Review it in GitHub Desktop, then commit and push when you are happy.
echo   You can delete finish-setup.bat now.
echo.
pause
