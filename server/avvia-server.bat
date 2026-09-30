@echo off
title Regia Tempi - server locale
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js non e' installato su questo PC.
  echo   Scaricalo da https://nodejs.org ^(versione LTS^), installalo e riprova.
  echo.
  pause
  exit /b 1
)
node regia-server.js
pause
