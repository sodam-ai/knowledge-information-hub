@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

REM ===== Knowledge Information Hub — Local Launcher (Windows) =====

set "NODE_ENV=production"
if "%PORT%"=="" set "PORT=3000"
if "%HOSTNAME%"=="" set "HOSTNAME=127.0.0.1"

REM 포터블 모드: 같은 폴더의 data\ 를 DB 위치로 사용
if "%KIH_DATA_DIR%"=="" set "KIH_DATA_DIR=%~dp0data"

REM SESSION_SECRET 자동 생성 (없을 때만)
if "%SESSION_SECRET%"=="" (
  for /f "delims=" %%i in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set "SESSION_SECRET=%%i"
)

REM 초기 비밀번호 (없을 때만 — 첫 실행 후 /admin 에서 변경 가능)
if "%VIEW_PASSWORD%"=="" set "VIEW_PASSWORD=1234"
if "%ADMIN_PASSWORD%"=="" set "ADMIN_PASSWORD=admin1234"

echo ============================================================
echo   Knowledge Information Hub - Local
echo ============================================================
echo   URL        : http://%HOSTNAME%:%PORT%
echo   DATA       : %KIH_DATA_DIR%
echo   PASSWORD   : %VIEW_PASSWORD% ^(첫 실행 후 /admin 에서 변경^)
echo ============================================================
echo.
echo 브라우저가 자동으로 열립니다. Ctrl+C 로 종료하세요.
echo.

REM === 자동 백업 (일 1회, 30일 보관) ===
node "%~dp0scripts\backup.mjs" 2>nul

REM 브라우저 자동 열기
start "" "http://%HOSTNAME%:%PORT%"

REM Next.js standalone 서버 실행
cd /d "%~dp0"
node server.js

endlocal
