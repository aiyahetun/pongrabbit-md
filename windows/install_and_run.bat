@echo off
setlocal EnableExtensions
rem NOTE: Do not use "else if" in cmd.exe — use nested "else ( if ... )".
rem Avoid chcp 65001 here so this file works as UTF-8 without mojibake on Chinese Windows.

set "ROOT=%~dp0.."
if exist "%ROOT%\pengtuzi-md\package.json" (
  cd /d "%ROOT%\pengtuzi-md"
) else (
  if exist "%ROOT%\mobimark_source\mobimark\package.json" (
    cd /d "%ROOT%\mobimark_source\mobimark"
  ) else (
    echo [ERROR] Project not found.
    echo Put the app in "pengtuzi-md" or "mobimark_source\mobimark" ^(must contain package.json^).
    pause
    exit /b 1
  )
)

echo.
echo Installing dependencies for pongrabbit-MD ^(first run may take several minutes^)...
echo.
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install LTS from https://nodejs.org
  pause
  exit /b 1
)
call npm install
if errorlevel 1 (
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)
echo.
echo Starting pongrabbit-MD...
echo.
call npm start
endlocal
