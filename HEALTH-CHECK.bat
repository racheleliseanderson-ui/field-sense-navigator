@echo off
setlocal enabledelayedexpansion
title Field Sense - Health Check
cd /d "%~dp0"
color 0F
mode con: cols=100 lines=45

echo.
echo  ================================================================
echo    HEALTH CHECK
echo  ================================================================
echo.
echo   Answers four questions in about a second:
echo     - How old is the information?
echo     - Are there any duplicates?
echo     - How much can the catalogue actually answer?
echo     - Is anything being read from a source it should not be?
echo.
echo   It only reads. It changes nothing. It installs nothing.
echo.
echo  ----------------------------------------------------------------
echo.
pause
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo   ^>^> STOPPED. Node.js is not installed. Get it at https://nodejs.org
  echo.
  pause
  exit /b 1
)
if exist ".git\index.lock" del /f /q ".git\index.lock" >nul 2>&1

call node scripts\pipeline\health.mjs

echo  ================================================================
echo   Nothing was changed.
echo.
echo   If it says records are past their review date, run RUN-REFRESH.
echo   If it lists a source that is "neither an agency nor a named
echo   authority", tell Claude - that record needs a better page.
echo   If it lists the same water twice, tell Claude and it will merge
echo   them.
echo.
echo   The full list is in the newest health file in the reports folder.
echo  ================================================================
echo.
pause
endlocal
