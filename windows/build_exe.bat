@echo off
setlocal EnableExtensions
rem Nested if/else only — cmd.exe does not support ") else if (".

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
echo Building Windows installer and portable exe for pongrabbit-MD...
echo.
if not exist "node_modules" (
  echo [ERROR] Run windows\install_and_run.bat first ^(npm install^).
  pause
  exit /b 1
)
call npm run build
if errorlevel 1 (
  echo [ERROR] Build failed.
  pause
  exit /b 1
)
echo.
echo Done. Opening dist folder...
explorer dist
pause
endlocal
