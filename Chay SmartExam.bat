@echo off
chcp 65001 >nul
title SmartExam AI
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Chua cai Node.js. Tai ban LTS tai https://nodejs.org roi chay lai file nay.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Lan dau: dang cai thu vien...
  call npm install
  if errorlevel 1 ( echo Cai thu vien loi. Kiem tra mang roi thu lai. & pause & exit /b 1 )
)
if not exist dist\index.html (
  echo Dang build giao dien...
  call npm run build
  if errorlevel 1 ( echo Build loi. & pause & exit /b 1 )
)
start "" /min cmd /c "timeout /t 3 >nul & start http://localhost:4700"
node server\index.mjs
pause
